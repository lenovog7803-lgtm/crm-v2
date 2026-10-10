import { useEffect, useMemo, useState } from 'react'
import { getGoals, saveGoals, getOrders } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import { SkeletonCard } from '../components/Skeleton'
import CardGradient from '../components/CardGradient'
import { ModalOverlay, ModalHeader } from '../components/Modal'
import { BarChart } from '../bklit/charts/bar-chart'
import { Bar } from '../bklit/charts/bar'
import { BarXAxis } from '../bklit/charts/bar-x-axis'
import { Grid } from '../bklit/charts/grid'
import { ChartTooltip } from '../bklit/charts/tooltip'
import '../bklit/bklit.css'
import { Forecasts, TrafficLight, SalesWeek } from './PlanBlocks'

// «План» — цели на год по месяцам и кварталам и их выполнение.
// Цели — те же «Цели месяца», что на дашборде (/goals): прибыль (маржа × 0,8, как считает сервер),
// рейсы, маржа на рейс, новые клиенты. Поставили здесь — видно на дашборде, и наоборот.
// Факт по прибыли и рейсам — с сервера (как на дашборде); новые клиенты — по первой заявке клиента
// (дата создания карточки на сервере у многих клиентов пустая); остальное считается из заявок.

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const k = v => { const a = Math.abs(v); return a >= 1000 ? `${String(+(v / 1000).toFixed(1)).replace('.', ',')}K` : String(Math.round(v)) }
const ym = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`

// План из отчёта «A2 Group: разбор и план 2027» (маржа 130K за год ≈ прибыль 104K по формуле дашборда)
const REPORT_PLAN = [
  { profit_goal: 7600, trips_goal: 48, margin_goal: 160, new_clients_goal: 2 },  // Q1: почистить цены
  { profit_goal: 8400, trips_goal: 50, margin_goal: 168, new_clients_goal: 2 },  // Q2: запустить продажи
  { profit_goal: 9200, trips_goal: 52, margin_goal: 176, new_clients_goal: 2 },  // Q3: меньше зависеть от топ-5
  { profit_goal: 9600, trips_goal: 50, margin_goal: 192, new_clients_goal: 2 },  // Q4: готовность к росту
]

const ruDir = /москв|петербург|санкт|смоленск|брянск|ульяновск|росси|подмоск|твер|калуг|ярослав|нижн|казан/i
const margin = o => (+o.client_rate || 0) - (+o.carrier_rate || 0)

// Ключевые результаты кварталов (из отчёта) — проверяются автоматически по заявкам квартала
const OKRS = [
  { title: 'Почистить цены и деньги', krs: [
    { label: '0 заявок в минус', check: q => ({ ok: q.loss === 0, value: `${q.loss} в минус` }) },
    { label: 'ЗападВет, Хольцгрупп, XCКомпозит — маржа ≥ 15%', check: q => {
      const low = ['ЗападВет', 'Хольцгрупп', 'XCКомпозит'].filter(n => { const c = q.byClient.find(x => x.name.includes(n)); return c && c.rev > 0 && c.mg / c.rev < 0.15 })
      return { ok: low.length === 0, value: low.length ? `ниже: ${low.join(', ')}` : 'все выше 15%' } } },
    { label: 'Маржа на заявку ≥ 200 Br', check: q => ({ ok: q.perOrder >= 200, value: `${int(q.perOrder)} Br` }) },
  ] },
  { title: 'Запустить продажи', krs: [
    { label: '3 новых клиента с 3+ заявками', check: q => ({ ok: q.newRegular >= 3, value: `${q.newRegular} из 3` }) },
    { label: 'Москва → Минск: маржа ≥ 240 Br с заявки', check: q => ({ ok: q.ruBy >= 240, value: q.ruBy ? `${int(q.ruBy)} Br` : 'нет заявок' }) },
  ] },
  { title: 'Меньше зависеть от топ-клиентов', krs: [
    { label: 'Доля топ-5 клиентов ≤ 65%', check: q => ({ ok: q.top5 <= 65, value: `${q.top5}%` }) },
    { label: 'Маржа за квартал ≥ 34K Br', check: q => ({ ok: q.mg >= 34000, value: `${k(q.mg)} Br` }) },
  ] },
  { title: 'Готовность к росту', krs: [
    { label: 'Маржа за год ≥ 130K Br', check: (q, y) => ({ ok: y.mg >= 130000, value: `${k(y.mg)} Br` }) },
    { label: 'Маржа на заявку за год ≥ 220 Br', check: (q, y) => ({ ok: y.perOrder >= 220, value: `${int(y.perOrder)} Br` }) },
  ] },
]

// Сводка по набору заявок: маржа, клиенты, направления
function summarize(orders) {
  const mg = orders.reduce((s, o) => s + margin(o), 0)
  const byClientMap = {}
  orders.forEach(o => { const c = byClientMap[o.client_id] || (byClientMap[o.client_id] = { name: o.client_name || '', n: 0, rev: 0, mg: 0 }); c.n++; c.rev += +o.client_rate || 0; c.mg += margin(o) })
  const byClient = Object.values(byClientMap).sort((a, b) => b.mg - a.mg)
  const ru = orders.filter(o => ruDir.test(o.route_from || '') && !ruDir.test(o.route_to || ''))
  return {
    n: orders.length, mg,
    perOrder: orders.length ? mg / orders.length : 0,
    loss: orders.filter(o => +o.client_rate > 0 && margin(o) < 0).length,
    top5: mg > 0 ? Math.round(byClient.slice(0, 5).reduce((s, c) => s + c.mg, 0) / mg * 100) : 0,
    ruBy: ru.length ? ru.reduce((s, o) => s + margin(o), 0) / ru.length : 0,
    byClient,
  }
}

const statusOf = (fact, plan, started) => {
  if (!started) return { label: 'впереди', cls: '' }
  if (!plan) return { label: 'нет цели', cls: '' }
  const r = fact / plan
  if (r >= 1) return { label: 'по плану', cls: 'g' }
  if (r >= 0.85) return { label: 'чуть отстаёт', cls: 'o' }
  return { label: 'отстаёт', cls: 'r' }
}

function Bar100({ pct, color = '#1366F0' }) {
  return (
    <div className="plan-bar"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
  )
}

export default function Plan() {
  const isMobile = useIsMobile()
  const { show } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear())
  const [goals, setGoals] = useState(null)
  const [orders, setOrders] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setGoals(null)
    Promise.all(MONTHS.map((_, m) => getGoals(ym(year, m)))).then(setGoals).catch(() => { setGoals([]); show('Не удалось загрузить цели', { type: 'error' }) })
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    getOrders({ limit: 5000, light: true }).then(r => setOrders(Array.isArray(r) ? r : (r?.orders || r?.data || []))).catch(() => setOrders([]))
  }, [])

  const data = useMemo(() => {
    if (!goals || !orders) return null
    const live = orders.filter(o => o.status !== 'cancelled')
    const monthOf = o => (o.unload_date || o.load_date || '').slice(0, 7)
    // первая заявка каждого клиента — чтобы понять, новый ли он в квартале
    const first = new Map()
    live.forEach(o => { const m = monthOf(o); if (!/^\d{4}-\d{2}$/.test(m)) return; const f = first.get(o.client_id); if (!f || m < f) first.set(o.client_id, m) })
    const curYm = ym(now.getFullYear(), now.getMonth())
    const newByMonth = {}
    first.forEach(m => { newByMonth[m] = (newByMonth[m] || 0) + 1 })
    // текущий месяц идёт не целиком — план к сегодняшнему дню пропорционален прошедшим дням
    const dayShare = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const months = MONTHS.map((label, m) => {
      const key = ym(year, m), g = goals[m] || {}
      const plan = +g.profit_goal || 0
      return { label, key, started: key <= curYm, current: key === curYm, plan, planToDate: key < curYm ? plan : key === curYm ? plan * dayShare : 0,
        fact: +g.profit_fact || 0,
        trips: +g.trips_fact || 0, tripsPlan: +g.trips_goal || 0, newCl: newByMonth[key] || 0, newClPlan: +g.new_clients_goal || 0,
        perTrip: +g.margin_fact || 0, perTripPlan: +g.margin_goal || 0 }
    })
    const yearOrders = live.filter(o => monthOf(o).startsWith(String(year)))
    const summ = arr => {
      const s = summarize(arr)
      // новые «регулярные»: первая заявка клиента в этом наборе и 3+ заявки
      const range = new Set(arr.map(monthOf))
      s.newRegular = Object.values(arr.reduce((acc, o) => { (acc[o.client_id] ||= []).push(o); return acc }, {}))
        .filter(list => list.length >= 3 && range.has(first.get(list[0].client_id))).length
      return s
    }
    const yearSum = summ(yearOrders)
    const quarters = [0, 1, 2, 3].map(q => {
      const ms = months.slice(q * 3, q * 3 + 3)
      const qOrders = yearOrders.filter(o => { const m = +monthOf(o).slice(5, 7) - 1; return m >= q * 3 && m < q * 3 + 3 })
      const elapsed = ms.filter(m => m.started)
      return { q, ms, started: elapsed.length > 0, done: elapsed.length === 3 && !ms[2].current,
        plan: ms.reduce((s, m) => s + m.plan, 0), planToDate: ms.reduce((s, m) => s + m.planToDate, 0),
        fact: ms.reduce((s, m) => s + m.fact, 0), trips: ms.reduce((s, m) => s + m.trips, 0), tripsPlan: ms.reduce((s, m) => s + m.tripsPlan, 0),
        newCl: ms.reduce((s, m) => s + m.newCl, 0), newClPlan: ms.reduce((s, m) => s + m.newClPlan, 0), sum: summ(qOrders) }
    })
    const planYear = months.reduce((s, m) => s + m.plan, 0)
    const factYear = months.reduce((s, m) => s + m.fact, 0)
    // прогноз: факт + средняя прибыль последних 3 полных месяцев × оставшиеся месяцы
    const lastFull = []
    for (let i = 1; i <= 3; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); lastFull.push(ym(d.getFullYear(), d.getMonth())) }
    const pace = lastFull.reduce((s, key) => s + live.filter(o => monthOf(o) === key).reduce((t, o) => t + margin(o) * 0.8, 0), 0) / 3
    const remaining = months.filter(m => !m.started || m.current).length
    const forecast = factYear + pace * remaining
    return { live, months, quarters, planYear, factYear, forecast, pace, yearSum, anyFact: months.some(m => m.started) }
  }, [goals, orders, year]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) {
    return <div style={{ display: 'grid', gap: 12 }}><SkeletonCard lines={3} /><SkeletonCard lines={4} /><SkeletonCard lines={4} /></div>
  }

  const { live, months, quarters, planYear, factYear, forecast, pace, yearSum, anyFact } = data
  const pctYear = planYear ? Math.round(factYear / planYear * 100) : 0
  const forecastPct = planYear ? Math.round(forecast / planYear * 100) : 0
  const yearTabs = [now.getFullYear(), now.getFullYear() + 1].map(y => ({ key: y, label: String(y) }))
  const chartData = months.map(m => ({ month: m.label, plan: m.plan, fact: m.started ? m.fact : 0 }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SlidingTabs options={yearTabs} value={year} onChange={setYear} />
        <button className="btn-ghost" style={{ marginLeft: 'auto', borderRadius: 99 }} onClick={() => setEditing(true)}>Изменить цели</button>
      </div>

      {/* Год: главная карточка */}
      <div className="grad-card grad-blue" style={{ padding: isMobile ? '18px 18px' : '26px 28px' }}>
        <CardGradient tone="blue" />
        <div className="grad-kicker">Прибыль за {year} год</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: isMobile ? 32 : 40, letterSpacing: '-0.03em', lineHeight: 1 }}>{int(factYear)}</span>
          <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>из {int(planYear)} Br · {pctYear}%</span>
        </div>
        <div className="plan-bar plan-bar--hero"><div style={{ width: `${Math.min(100, pctYear)}%` }} /></div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          <span>Прогноз на год: <b style={{ color: '#fff' }}>{int(forecast)} Br</b> ({forecastPct}% плана)</span>
          <span>Темп: <b style={{ color: '#fff' }}>{int(pace)} Br</b> в месяц за последние 3 мес.</span>
        </div>
        {!anyFact && <div style={{ marginTop: 10, fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>Год ещё не начался — прогноз по нынешнему темпу. Чтобы выйти на план, нужно {int(planYear / 12)} Br в месяц.</div>}
      </div>

      {/* Показатели года */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
        {[
          { label: 'Рейсы', color: '#1366F0', fact: months.reduce((s, m) => s + m.trips, 0), plan: months.reduce((s, m) => s + m.tripsPlan, 0) },
          { label: 'Маржа на заявку', color: '#7C3AED', fact: Math.round(yearSum.perOrder), plan: 220, unit: ' Br', note: 'цель ≥ 220' },
          { label: 'Новые клиенты', color: '#1E9E5A', fact: months.reduce((s, m) => s + m.newCl, 0), plan: months.reduce((s, m) => s + m.newClPlan, 0) },
          { label: 'Доля топ-5 клиентов', color: '#D97706', fact: yearSum.top5, plan: 60, unit: '%', note: 'цель ≤ 60%', inverse: true },
        ].map(t => (
          <div key={t.label} className="ios-widget" style={{ padding: isMobile ? '14px 16px' : '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.color, marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: '#0E1726' }}>{anyFact ? `${int(t.fact)}${t.unit || ''}` : '—'}</div>
            <div style={{ fontSize: 12, color: '#8A93A0', margin: '2px 0 8px' }}>{t.note || `из ${int(t.plan)}`}</div>
            <Bar100 pct={t.inverse ? (t.fact ? t.plan / t.fact * 100 : 0) : (t.plan ? t.fact / t.plan * 100 : 0)} color={t.color} />
          </div>
        ))}
      </div>

      {/* План и факт по месяцам */}
      <div className="ios-widget" style={{ padding: isMobile ? '16px 14px 10px' : '22px 24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Прибыль по месяцам</div>
          <span className="plan-legend"><i style={{ background: '#C9D8F5' }} />план</span>
          <span className="plan-legend"><i style={{ background: '#1366F0' }} />факт</span>
        </div>
        <div className="bklit" style={{ height: isMobile ? 180 : 220 }}>
          <BarChart data={chartData} xDataKey="month" aspectRatio="auto" margin={{ left: 4, right: 4, top: 10, bottom: 26 }}>
            <Grid horizontal />
            <Bar dataKey="plan" fill="#C9D8F5" lineCap="round" />
            <Bar dataKey="fact" fill="var(--chart-line-primary)" lineCap="round" />
            <BarXAxis />
            <ChartTooltip rows={p => [
              { color: '#C9D8F5', label: 'План', value: `${int(p.plan)} Br` },
              { color: 'var(--chart-line-primary)', label: 'Факт', value: `${int(p.fact)} Br` },
            ]} />
          </BarChart>
        </div>
      </div>

      {/* Кварталы */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 16 }}>
        {quarters.map(q => {
          const st = statusOf(q.fact, q.planToDate, q.started)
          const okr = OKRS[q.q]
          return (
            <div key={q.q} className="ios-widget" style={{ padding: isMobile ? '16px 16px' : '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#0E1726' }}>{q.q + 1} квартал</div>
                <span className={`plan-pill ${st.cls}`}>{st.label}</span>
              </div>
              <div style={{ fontSize: 13, color: '#5A6573', margin: '2px 0 12px' }}>{okr.title}</div>
              <div className="plan-metric">
                <span>Прибыль</span><b>{int(q.fact)} / {int(q.plan)}</b>
                <Bar100 pct={q.plan ? q.fact / q.plan * 100 : 0} />
              </div>
              <div className="plan-metric">
                <span>Рейсы</span><b>{q.trips} / {q.tripsPlan}</b>
                <Bar100 pct={q.tripsPlan ? q.trips / q.tripsPlan * 100 : 0} color="#7C3AED" />
              </div>
              <div className="plan-metric">
                <span>Новые клиенты</span><b>{q.newCl} / {q.newClPlan}</b>
                <Bar100 pct={q.newClPlan ? q.newCl / q.newClPlan * 100 : 0} color="#1E9E5A" />
              </div>
              <div className="plan-krs">
                {okr.krs.map(kr => {
                  const r = q.started ? kr.check(q.sum, yearSum) : null
                  return (
                    <div key={kr.label} className="plan-kr">
                      <span className={`plan-kr-dot ${r ? (r.ok ? 'ok' : (q.done ? 'fail' : 'wip')) : ''}`} />
                      <span style={{ flex: 1 }}>{kr.label}</span>
                      <span className="plan-kr-val">{r ? r.value : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Месяцы списком */}
      <div className="ios-list">
        {months.map(m => {
          const st = statusOf(m.fact, m.planToDate, m.started)
          return (
            <div key={m.key} className="plan-month">
              <div className="plan-month-name">{m.label}{m.current && <span className="plan-now">сейчас</span>}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Bar100 pct={m.plan ? m.fact / m.plan * 100 : 0} />
              </div>
              <div className="plan-month-num">{m.started ? int(m.fact) : '—'} <span>/ {int(m.plan)}</span></div>
              {!isMobile && <div className="plan-month-num" style={{ width: 80 }}>{m.started ? m.trips : '—'} <span>/ {m.tripsPlan} рейс.</span></div>}
              <span className={`plan-pill ${st.cls}`}>{st.label}</span>
            </div>
          )
        })}
      </div>
      {/* Раскрывающиеся блоки внизу: качество заявок, продажи по расписанию, прогнозы */}
      <TrafficLight orders={live} />
      <SalesWeek orders={live} />
      <Forecasts orders={live} months={months} planYear={planYear} factYear={factYear} pace={pace} year={year} />

      <div style={{ fontSize: 12, color: '#A6AEB8', padding: '0 4px' }}>
        Прибыль считается как на дашборде: маржа × 0,8. Маржа на заявку и доля топ-5 — по чистой марже из заявок.
      </div>

      {editing && <GoalsEditor year={year} goals={goals} onClose={() => setEditing(false)}
        onSaved={next => { setGoals(next); setEditing(false); show('Цели сохранены', { type: 'success' }) }} />}
    </div>
  )
}

// Цели по месяцам: 4 числа на месяц, «Заполнить по плану» — значения из годового плана
function GoalsEditor({ year, goals, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(() => MONTHS.map((_, m) => {
    const g = goals[m] || {}
    return { profit_goal: g.profit_goal ?? 7000, trips_goal: g.trips_goal ?? 45, margin_goal: g.margin_goal ?? 230, new_clients_goal: g.new_clients_goal ?? 9 }
  }))
  const [saving, setSaving] = useState(false)
  const set = (m, f, v) => setRows(r => r.map((x, i) => i === m ? { ...x, [f]: v } : x))
  const fields = [['profit_goal', 'Прибыль'], ['trips_goal', 'Рейсы'], ['margin_goal', 'Маржа/рейс'], ['new_clients_goal', 'Новые кл.']]

  const save = async () => {
    setSaving(true)
    try {
      const saved = await Promise.all(rows.map((r, m) => saveGoals({
        month: ym(year, m), profit_goal: +r.profit_goal || 0, trips_goal: Math.round(+r.trips_goal || 0),
        margin_goal: +r.margin_goal || 0, new_clients_goal: Math.round(+r.new_clients_goal || 0),
      })))
      onSaved(saved.map((s, m) => ({ ...goals[m], ...s })))
    } catch {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} panelStyle={{ maxWidth: 640 }}>
      <ModalHeader title={`Цели на ${year}`} onClose={onClose} />
      <div style={{ fontSize: 13, color: '#5A6573', marginBottom: 12 }}>
        Те же цели, что в «Цели месяца» на дашборде. Прибыль — маржа × 0,8.
      </div>
      <button className="btn-ghost" style={{ borderRadius: 99, marginBottom: 14 }}
        onClick={() => setRows(MONTHS.map((_, m) => ({ ...REPORT_PLAN[Math.floor(m / 3)] })))}>
        Заполнить по плану из отчёта
      </button>
      <div style={{ overflowX: 'auto' }}>
        <table className="plan-edit">
          <thead><tr><th>Месяц</th>{fields.map(([f, l]) => <th key={f}>{l}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, m) => (
              <tr key={m}>
                <td>{MONTHS[m]}</td>
                {fields.map(([f]) => (
                  <td key={f}><input type="number" inputMode="numeric" value={r[f]} onChange={e => set(m, f, e.target.value)}
                    style={{ width: isMobile ? 70 : 96, padding: '6px 8px' }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center', borderRadius: 99 }} onClick={onClose}>Отмена</button>
        <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', borderRadius: 99 }} disabled={saving} onClick={save}>
          {saving ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </ModalOverlay>
  )
}
