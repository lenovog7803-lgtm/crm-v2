import { useEffect, useMemo, useState } from 'react'
import { getLeadsAnalytics, getMailingState } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'
import { SlidingTabs } from '../components/SlidingTabs'

// Блоки вкладки «План»: прогнозы, светофор пустых заявок, неделя продаж.
// Всё считается из заявок, звонков «Базы обзвона» и журнала «Рассылки» — без доработки сервера.

const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const margin = o => (+o.client_rate || 0) - (+o.carrier_rate || 0)
const monthOf = o => (o.unload_date || o.load_date || '').slice(0, 7)
const dayOf = o => (o.load_date || o.unload_date || '').slice(0, 10)
const ym = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const iso = d => `${ym(d)}-${String(d.getDate()).padStart(2, '0')}`
const PROFIT = 0.8  // прибыль = маржа × 0,8 — как на дашборде и в целях месяца

// Порог из отчёта: заявка «пустая», если маржа меньше 150 Br или меньше 15%
export const MIN_MARGIN = 150, MIN_PCT = 0.15
const lightOf = o => {
  const mg = margin(o), rev = +o.client_rate || 0
  if (rev > 0 && mg < 0) return 'red'
  if (mg < MIN_MARGIN || (rev > 0 && mg / rev < MIN_PCT)) return 'yellow'
  return 'green'
}

function Card({ title, right, children }) {
  const isMobile = useIsMobile()
  return (
    <div className="ios-widget" style={{ padding: isMobile ? '16px 16px' : '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

// ===== Прогнозы: сценарии на год и «что нужно, чтобы выйти на план» =====
export function Forecasts({ orders, months, planYear, factYear, pace, year }) {
  const now = new Date()
  const f = useMemo(() => {
    const remaining = months.filter(m => !m.started || m.current).length
    const last3 = [1, 2, 3].map(i => ym(new Date(now.getFullYear(), now.getMonth() - i, 1)))
    const last3Orders = orders.filter(o => last3.includes(monthOf(o)))
    const last3Mg = last3Orders.reduce((s, o) => s + margin(o), 0)
    // крупнейший клиент последних 3 месяцев — для плохого сценария
    const byCl = {}
    last3Orders.forEach(o => { byCl[o.client_name] = (byCl[o.client_name] || 0) + margin(o) })
    const [topName, topMg] = Object.entries(byCl).sort((a, b) => b[1] - a[1])[0] || ['', 0]
    const topShare = last3Mg > 0 ? topMg / last3Mg : 0
    // лучший квартал (3 месяца подряд) за последний год
    let best = 0
    for (let i = 1; i <= 10; i++) {
      const w = [0, 1, 2].map(j => ym(new Date(now.getFullYear(), now.getMonth() - i - j, 1)))
      best = Math.max(best, orders.filter(o => w.includes(monthOf(o))).reduce((s, o) => s + margin(o), 0) * PROFIT / 3)
    }
    const cur = months.find(m => m.current)
    const futurePlan = months.filter(m => !m.started).reduce((s, m) => s + m.plan, 0)
    const perOrder = last3Orders.length ? last3Mg * PROFIT / last3Orders.length : 0
    const scenarios = [
      { key: 'bad', label: 'Плохой', note: topName ? `уходит «${topName.replace(/^(ООО|ЧТУП|ИП)\s*/, '').replace(/[«»"“”]/g, '')}» (${Math.round(topShare * 100)}% маржи)` : 'уходит крупнейший клиент', value: factYear + pace * (1 - topShare) * remaining, color: '#D63B30' },
      { key: 'now', label: 'Как сейчас', note: `темп ${int(pace)} Br в месяц`, value: factYear + pace * remaining, color: '#8A93A0' },
      { key: 'plan', label: 'По плану', note: 'оставшиеся месяцы — точно по цели', value: factYear + futurePlan + (cur ? Math.max(0, cur.plan - cur.fact) : 0), color: '#1366F0' },
      { key: 'best', label: 'Лучший темп', note: `как в лучший квартал: ${int(best)} Br в месяц`, value: factYear + best * remaining, color: '#1E9E5A' },
    ]
    const need = Math.max(0, planYear - factYear)
    const needPerMonth = remaining ? need / remaining : 0
    return { remaining, scenarios, need, needPerMonth, perOrder, ordersAtNow: perOrder ? needPerMonth / perOrder : 0, ordersAtTarget: needPerMonth / (220 * PROFIT) }
  }, [orders, months, planYear, factYear, pace]) // eslint-disable-line react-hooks/exhaustive-deps

  const max = Math.max(planYear, ...f.scenarios.map(s => s.value), 1)
  return (
    <Card title={`Прогнозы на ${year}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {f.scenarios.map(s => (
          <div key={s.key}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
              <b style={{ color: s.color, fontWeight: 600, width: 96, flexShrink: 0 }}>{s.label}</b>
              <span style={{ flex: 1, color: '#8A93A0', fontSize: 12, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.note}</span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: '#0E1726' }}>{int(s.value)} Br</b>
              <span style={{ width: 44, textAlign: 'right', fontSize: 12, color: s.value >= planYear ? '#1E9E5A' : '#8A93A0' }}>{planYear ? Math.round(s.value / planYear * 100) : 0}%</span>
            </div>
            <div className="plan-scn">
              <div style={{ width: `${s.value / max * 100}%`, background: s.color }} />
              <i style={{ left: `${planYear / max * 100}%` }} title="план" />
            </div>
          </div>
        ))}
      </div>
      <div className="plan-need">
        {f.need > 0 ? <>
          <div><b>Чтобы выйти на план {int(planYear)} Br</b>, осталось заработать <b>{int(f.need)} Br</b> за {f.remaining} мес. — по <b>{int(f.needPerMonth)} Br</b> в месяц.</div>
          <div style={{ marginTop: 4 }}>
            Это <b>{Math.round(f.ordersAtNow)}</b> заявок в месяц при нынешней прибыли с заявки ({int(f.perOrder)} Br)
            или <b>{Math.round(f.ordersAtTarget)}</b> — если поднять маржу до 220 Br.
          </div>
        </> : <div><b>План года уже выполнен</b> — всё сверху идёт в плюс.</div>}
      </div>
    </Card>
  )
}

// ===== Светофор пустых заявок =====
export function TrafficLight({ orders }) {
  const now = new Date()
  const [range, setRange] = useState('month')
  const periods = { month: ym(now), prev: ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), year: String(now.getFullYear()) }
  const list = orders.filter(o => (range === 'year' ? monthOf(o).startsWith(periods.year) : monthOf(o) === periods[range]) && +o.client_rate > 0)
  const groups = { green: [], yellow: [], red: [] }
  list.forEach(o => groups[lightOf(o)].push(o))
  const sum = arr => arr.reduce((s, o) => s + margin(o), 0)
  const total = list.length || 1
  const bad = [...groups.yellow, ...groups.red]
  const byCl = {}
  bad.forEach(o => { const c = byCl[o.client_name] || (byCl[o.client_name] = { n: 0, mg: 0 }); c.n++; c.mg += margin(o) })
  const worst = Object.entries(byCl).sort((a, b) => b[1].n - a[1].n).slice(0, 5)
  const segs = [
    { key: 'green', label: 'Нормальные', hint: `≥ ${MIN_MARGIN} Br и ≥ 15%`, color: '#1E9E5A' },
    { key: 'yellow', label: 'Пустые', hint: 'ниже порога', color: '#D97706' },
    { key: 'red', label: 'В минус', hint: 'маржа меньше нуля', color: '#D63B30' },
  ]
  return (
    <Card title="Светофор заявок" right={
      <SlidingTabs value={range} onChange={setRange} fontSize={12}
        options={[{ key: 'month', label: 'Этот месяц' }, { key: 'prev', label: 'Прошлый' }, { key: 'year', label: 'Год' }]} />
    }>
      {list.length === 0 ? <div style={{ fontSize: 13, color: '#A6AEB8' }}>Заявок за период нет</div> : <>
        <div className="plan-light-bar">
          {segs.map(s => groups[s.key].length > 0 && <div key={s.key} style={{ flex: groups[s.key].length, background: s.color }} />)}
        </div>
        <div className="plan-light-legend">
          {segs.map(s => (
            <div key={s.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ background: s.color }} /><b>{s.label}</b></div>
              <div className="plan-light-n">{groups[s.key].length} <span>· {Math.round(groups[s.key].length / total * 100)}%</span></div>
              <div className="plan-light-sub">{int(sum(groups[s.key]))} Br маржи · {s.hint}</div>
            </div>
          ))}
        </div>
        {bad.length > 0 && (
          <div className="plan-light-worst">
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8A93A0', marginBottom: 6 }}>У кого больше всего пустых и минусовых</div>
            {worst.map(([name, c]) => (
              <div key={name} className="plan-kr">
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                <span className="plan-kr-val">{c.n} заяв. · {int(c.mg)} Br</span>
              </div>
            ))}
          </div>
        )}
      </>}
    </Card>
  )
}

// ===== Неделя продаж: расписание «вт, ср, чт — по 2 часа продаж» =====
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const SALES_DAYS = [1, 2, 3]  // вт, ср, чт
export const GOAL_CALLS = 30, GOAL_LETTERS = 30

export function SalesWeek({ orders }) {
  const isMobile = useIsMobile()
  const [shift, setShift] = useState(0)
  const [calls, setCalls] = useState(null)
  const [letters, setLetters] = useState(null)
  useEffect(() => {
    getLeadsAnalytics('all').then(a => setCalls(a?.calls_by_day || [])).catch(() => setCalls([]))
    getMailingState().then(s => setLetters(s?.log || [])).catch(() => setLetters([]))
  }, [])

  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) - shift * 7)
  const days = WEEK.map((label, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return { label, date: iso(d), num: d.getDate(), future: d > now } })
  const callsBy = Object.fromEntries((calls || []).map(c => [c.date, c.calls]))
  const lettersBy = {}
  ;(letters || []).forEach(l => { if (l.kind === 'письмо' && l.ok !== false) lettersBy[l.day] = (lettersBy[l.day] || 0) + 1 })
  // новые клиенты — первая заявка клиента пришлась на эту неделю
  const first = new Map()
  orders.forEach(o => { const d = dayOf(o); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return; const f = first.get(o.client_id); if (!f || d < f.d) first.set(o.client_id, { d, name: o.client_name }) })
  const newClients = [...first.values()].filter(f => f.d >= days[0].date && f.d <= days[6].date)

  const totCalls = days.reduce((s, d) => s + (callsBy[d.date] || 0), 0)
  const totLetters = days.reduce((s, d) => s + (lettersBy[d.date] || 0), 0)
  const salesDone = SALES_DAYS.filter(i => !days[i].future && ((callsBy[days[i].date] || 0) + (lettersBy[days[i].date] || 0)) > 0).length
  const salesPassed = SALES_DAYS.filter(i => !days[i].future).length
  const maxDay = Math.max(1, ...days.map(d => (callsBy[d.date] || 0) + (lettersBy[d.date] || 0)))

  return (
    <Card title="Неделя продаж" right={
      <SlidingTabs value={shift} onChange={setShift} fontSize={12} options={[{ key: 0, label: 'Эта неделя' }, { key: 1, label: 'Прошлая' }]} />
    }>
      {calls === null ? <div style={{ fontSize: 13, color: '#A6AEB8' }}>Загружаю…</div> : <>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Звонки', v: totCalls, goal: GOAL_CALLS, color: '#1366F0' },
            { label: 'Письма', v: letters === null ? '…' : totLetters, goal: GOAL_LETTERS, color: '#5856D6', note: letters === null ? 'журнал рассылки грузится ~10 с' : null },
            { label: 'Дни продаж', v: salesDone, goal: 3, color: '#D97706', note: `вт, ср, чт · прошло ${salesPassed}` },
            { label: 'Новые клиенты', v: newClients.length, goal: null, color: '#1E9E5A', note: newClients.map(c => c.name).join(', ') || 'пока нет' },
          ].map(t => (
            <div key={t.label} className="plan-week-stat">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: t.color }}>{t.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0E1726', letterSpacing: '-0.02em' }}>{t.v}{t.goal != null && <span style={{ fontSize: 13, fontWeight: 500, color: '#A6AEB8' }}> / {t.goal}</span>}</div>
              {t.goal != null && <div className="plan-bar" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, (+t.v || 0) / t.goal * 100)}%`, background: t.color }} /></div>}
              {t.note && <div style={{ fontSize: 11.5, color: '#8A93A0', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note}</div>}
            </div>
          ))}
        </div>
        <div className="plan-week">
          {days.map((d, i) => {
            const c = callsBy[d.date] || 0, l = lettersBy[d.date] || 0
            const sales = SALES_DAYS.includes(i)
            return (
              <div key={d.date} className={`plan-day${sales ? ' is-sales' : ''}${d.future ? ' is-future' : ''}`}>
                <div className="plan-day-bars">
                  <div style={{ height: `${l / maxDay * 100}%`, background: '#5856D6' }} />
                  <div style={{ height: `${c / maxDay * 100}%`, background: '#1366F0' }} />
                </div>
                <div className="plan-day-n">{c + l || ''}</div>
                <div className="plan-day-label">{d.label} <span>{d.num}</span></div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 11.5, color: '#8A93A0', flexWrap: 'wrap' }}>
          <span className="plan-legend"><i style={{ background: '#1366F0' }} />звонки</span>
          <span className="plan-legend"><i style={{ background: '#5856D6' }} />письма</span>
          <span className="plan-legend"><i style={{ background: 'rgba(217,119,6,0.18)' }} />дни продаж по расписанию</span>
        </div>
      </>}
    </Card>
  )
}
