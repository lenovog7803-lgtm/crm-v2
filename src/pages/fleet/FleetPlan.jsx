import { useEffect, useMemo, useState } from 'react'
import { getFleetGoals, saveFleetGoals, getFleetAnalytics, getFleetTrips } from '../../api'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useToast } from '../../components/Toast'
import { SlidingTabs } from '../../components/SlidingTabs'
import { SkeletonCard } from '../../components/Skeleton'
import CardGradient from '../../components/CardGradient'
import { ModalOverlay, ModalHeader } from '../../components/Modal'
import { BarChart } from '../../bklit/charts/bar-chart'
import { Bar } from '../../bklit/charts/bar'
import { BarXAxis } from '../../bklit/charts/bar-x-axis'
import { Grid } from '../../bklit/charts/grid'
import { ChartTooltip } from '../../bklit/charts/tooltip'
import '../../bklit/bklit.css'

// «План» своего автопарка — как «План» экспедиции: цели по месяцам и кварталам и выполнение.
// Цели — свои (/fleet/goals): прибыль, рейсы, выручка. Факт — аналитика автопарка
// (прибыль и выручка по месяцам, по дате первой загрузки рейса) и список рейсов.

const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const ym = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`
const tripMonth = t => (t.first_load_date || t.created_at || '').slice(0, 7)

const statusOf = (fact, plan, started) => {
  if (!started) return { label: 'впереди', cls: '' }
  if (!plan) return { label: 'нет цели', cls: '' }
  const r = fact / plan
  if (r >= 1) return { label: 'по плану', cls: 'g' }
  if (r >= 0.85) return { label: 'чуть отстаёт', cls: 'o' }
  return { label: 'отстаёт', cls: 'r' }
}

const Bar100 = ({ pct, color = '#30B0C7' }) => (
  <div className="plan-bar"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
)

export default function FleetPlan() {
  const isMobile = useIsMobile()
  const { show } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear())
  const [goals, setGoals] = useState(null)
  const [fact, setFact] = useState(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setGoals(null); setFact(null)
    getFleetGoals(year).then(r => setGoals(r.months)).catch(() => { setGoals(MONTHS.map((_, m) => ({ month: ym(year, m) }))); show('Не удалось загрузить цели автопарка', { type: 'error' }) })
    Promise.all([getFleetAnalytics({ date_from: `${year}-01-01`, date_to: `${year}-12-31` }), getFleetTrips()])
      .then(([a, trips]) => setFact({ a, trips: (Array.isArray(trips) ? trips : trips?.trips || []).filter(t => tripMonth(t).startsWith(String(year))) }))
      .catch(() => setFact({ a: {}, trips: [] }))
  }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    if (!goals || !fact) return null
    const byMonth = Object.fromEntries((fact.a.by_month || []).map(m => [m.month, m]))
    const curYm = ym(now.getFullYear(), now.getMonth())
    const dayShare = now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const months = MONTHS.map((label, m) => {
      const key = ym(year, m), g = goals[m] || {}, f = byMonth[key] || {}
      const plan = +g.profit_goal || 0
      return { label, key, started: key <= curYm, current: key === curYm,
        plan, planToDate: key < curYm ? plan : key === curYm ? plan * dayShare : 0,
        fact: +f.profit || 0, revenue: +f.revenue || 0, revenuePlan: +g.revenue_goal || 0,
        trips: fact.trips.filter(t => tripMonth(t) === key).length, tripsPlan: +g.trips_goal || 0 }
    })
    const sum = (arr, f) => arr.reduce((s, m) => s + m[f], 0)
    const quarters = [0, 1, 2, 3].map(q => {
      const ms = months.slice(q * 3, q * 3 + 3)
      return { q, started: ms.some(m => m.started), plan: sum(ms, 'plan'), planToDate: sum(ms, 'planToDate'), fact: sum(ms, 'fact'),
        trips: sum(ms, 'trips'), tripsPlan: sum(ms, 'tripsPlan'), revenue: sum(ms, 'revenue'), revenuePlan: sum(ms, 'revenuePlan') }
    })
    const started = months.filter(m => m.started)
    const doneMonths = started.filter(m => !m.current)
    const pace = doneMonths.length ? sum(doneMonths.slice(-3), 'fact') / Math.min(3, doneMonths.length) : 0
    const remaining = months.filter(m => !m.started || m.current).length
    const factYear = sum(months, 'fact'), planYear = sum(months, 'plan')
    return { months, quarters, factYear, planYear, pace, forecast: factYear + pace * remaining, remaining,
      tripsYear: sum(months, 'trips'), tripsPlanYear: sum(months, 'tripsPlan'),
      revenueYear: sum(months, 'revenue'), revenuePlanYear: sum(months, 'revenuePlan'),
      emptyKm: fact.a.empty_km_pct || 0, lossTrips: fact.a.loss_trips || [], anyTrips: fact.trips.length > 0 }
  }, [goals, fact, year]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <div style={{ display: 'grid', gap: 12 }}><SkeletonCard lines={3} /><SkeletonCard lines={4} /></div>

  const { months, quarters, factYear, planYear, pace, forecast, tripsYear, tripsPlanYear, revenueYear, revenuePlanYear, emptyKm, lossTrips, anyTrips } = data
  const pctYear = planYear ? Math.round(factYear / planYear * 100) : 0
  const perTrip = tripsYear ? factYear / tripsYear : 0
  const yearTabs = [now.getFullYear(), now.getFullYear() + 1].map(y => ({ key: y, label: String(y) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SlidingTabs options={yearTabs} value={year} onChange={setYear} />
        <button className="btn-ghost" style={{ marginLeft: 'auto', borderRadius: 99 }} onClick={() => setEditing(true)}>Изменить цели</button>
      </div>

      <div className="grad-card grad-blue" style={{ padding: isMobile ? '18px 18px' : '26px 28px' }}>
        <CardGradient tone="blue" />
        <div className="grad-kicker">Прибыль автопарка за {year} год</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: isMobile ? 32 : 40, letterSpacing: '-0.03em', lineHeight: 1 }}>{int(factYear)}</span>
          <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>{planYear ? `из ${int(planYear)} Br · ${pctYear}%` : 'Br · цели не заданы'}</span>
        </div>
        <div className="plan-bar plan-bar--hero"><div style={{ width: `${Math.min(100, pctYear)}%` }} /></div>
        <div style={{ marginTop: 14, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          {anyTrips
            ? <>Прогноз на год: <b style={{ color: '#fff' }}>{int(forecast)} Br</b>{planYear ? ` (${Math.round(forecast / planYear * 100)}% плана)` : ''} · темп {int(pace)} Br в месяц</>
            : <>Рейсов за {year} пока нет — как только появятся, здесь будет факт и прогноз.{!planYear && ' Задайте цели кнопкой «Изменить цели».'}</>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 10 : 16 }}>
        {[
          { label: 'Рейсы', color: '#30B0C7', v: int(tripsYear), sub: tripsPlanYear ? `из ${int(tripsPlanYear)}` : 'цель не задана', pct: tripsPlanYear ? tripsYear / tripsPlanYear * 100 : 0 },
          { label: 'Выручка', color: '#1366F0', v: `${int(revenueYear)} Br`, sub: revenuePlanYear ? `из ${int(revenuePlanYear)}` : 'цель не задана', pct: revenuePlanYear ? revenueYear / revenuePlanYear * 100 : 0 },
          { label: 'Прибыль с рейса', color: '#7C3AED', v: anyTrips ? `${int(perTrip)} Br` : '—', sub: 'в среднем за год', pct: null },
          { label: 'Порожний пробег', color: '#D97706', v: anyTrips ? `${emptyKm}%` : '—', sub: 'чем меньше, тем лучше', pct: null },
        ].map(t => (
          <div key={t.label} className="ios-widget" style={{ padding: isMobile ? '14px 16px' : '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.color, marginBottom: 6 }}>{t.label}</div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', color: '#0E1726' }}>{t.v}</div>
            <div style={{ fontSize: 12, color: '#8A93A0', margin: '2px 0 8px' }}>{t.sub}</div>
            {t.pct !== null && <Bar100 pct={t.pct} color={t.color} />}
          </div>
        ))}
      </div>

      <div className="ios-widget" style={{ padding: isMobile ? '16px 14px 10px' : '22px 24px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Прибыль по месяцам</div>
          <span className="plan-legend"><i style={{ background: '#C9E7EE' }} />план</span>
          <span className="plan-legend"><i style={{ background: '#30B0C7' }} />факт</span>
        </div>
        <div className="bklit" style={{ height: isMobile ? 180 : 220 }}>
          <BarChart data={months.map(m => ({ month: m.label, plan: m.plan, fact: m.started ? Math.max(0, m.fact) : 0, raw: m.fact }))}
            xDataKey="month" aspectRatio="auto" margin={{ left: 4, right: 4, top: 10, bottom: 26 }}>
            <Grid horizontal />
            <Bar dataKey="plan" fill="#C9E7EE" lineCap="round" />
            <Bar dataKey="fact" fill="#30B0C7" lineCap="round" />
            <BarXAxis />
            <ChartTooltip rows={p => [
              { color: '#C9E7EE', label: 'План', value: `${int(p.plan)} Br` },
              { color: p.raw < 0 ? '#E0473B' : '#30B0C7', label: p.raw < 0 ? 'Убыток' : 'Факт', value: `${int(p.raw)} Br` },
            ]} />
          </BarChart>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 10 : 16 }}>
        {quarters.map(q => {
          const st = statusOf(q.fact, q.planToDate, q.started)
          return (
            <div key={q.q} className="ios-widget" style={{ padding: isMobile ? '16px 16px' : '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: '#0E1726' }}>{q.q + 1} квартал</div>
                <span className={`plan-pill ${st.cls}`}>{st.label}</span>
              </div>
              <div className="plan-metric"><span>Прибыль</span><b>{int(q.fact)} / {int(q.plan)}</b><Bar100 pct={q.plan ? q.fact / q.plan * 100 : 0} /></div>
              <div className="plan-metric"><span>Рейсы</span><b>{q.trips} / {q.tripsPlan}</b><Bar100 pct={q.tripsPlan ? q.trips / q.tripsPlan * 100 : 0} color="#7C3AED" /></div>
              <div className="plan-metric"><span>Выручка</span><b>{int(q.revenue)} / {int(q.revenuePlan)}</b><Bar100 pct={q.revenuePlan ? q.revenue / q.revenuePlan * 100 : 0} color="#1366F0" /></div>
            </div>
          )
        })}
      </div>

      <div className="ios-list">
        {months.map(m => {
          const st = statusOf(m.fact, m.planToDate, m.started)
          return (
            <div key={m.key} className="plan-month">
              <div className="plan-month-name">{m.label}{m.current && <span className="plan-now">сейчас</span>}</div>
              <div style={{ flex: 1, minWidth: 0 }}><Bar100 pct={m.plan ? m.fact / m.plan * 100 : 0} /></div>
              <div className="plan-month-num">{m.started ? int(m.fact) : '—'} <span>/ {int(m.plan)}</span></div>
              {!isMobile && <div className="plan-month-num" style={{ width: 80 }}>{m.started ? m.trips : '—'} <span>/ {m.tripsPlan} рейс.</span></div>}
              <span className={`plan-pill ${st.cls}`}>{st.label}</span>
            </div>
          )
        })}
      </div>

      {lossTrips.length > 0 && (
        <div className="ios-widget" style={{ padding: isMobile ? '16px 16px' : '20px 22px' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#0E1726', marginBottom: 10 }}>Убыточные рейсы за {year}</div>
          <div className="plan-krs" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            {lossTrips.map((t, i) => (
              <div key={t.id || i} className="plan-kr">
                <span className="plan-kr-dot fail" />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[t.trip_number ? `Рейс №${t.trip_number}` : 'Рейс', t.name, t.route].filter(Boolean).join(' · ')}</span>
                <span className="plan-kr-val" style={{ color: '#D63B30' }}>{int(t.profit)} Br</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && <FleetGoalsEditor year={year} goals={goals} onClose={() => setEditing(false)}
        onSaved={next => { setGoals(next); setEditing(false); show('Цели автопарка сохранены', { type: 'success' }) }} />}
    </div>
  )
}

function FleetGoalsEditor({ year, goals, onClose, onSaved }) {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState(() => MONTHS.map((_, m) => ({
    profit_goal: goals[m]?.profit_goal || 0, trips_goal: goals[m]?.trips_goal || 0, revenue_goal: goals[m]?.revenue_goal || 0,
  })))
  const [saving, setSaving] = useState(false)
  const set = (m, f, v) => setRows(r => r.map((x, i) => i === m ? { ...x, [f]: v } : x))
  const fields = [['profit_goal', 'Прибыль'], ['trips_goal', 'Рейсы'], ['revenue_goal', 'Выручка']]
  // «Как в первом месяце» — быстро заполнить весь год одинаковыми целями
  const fillFromFirst = () => setRows(r => r.map(() => ({ ...r[0] })))

  const save = async () => {
    setSaving(true)
    try {
      const res = await saveFleetGoals({ months: rows.map((r, m) => ({
        month: ym(year, m), profit_goal: +r.profit_goal || 0, trips_goal: Math.round(+r.trips_goal || 0), revenue_goal: +r.revenue_goal || 0,
      })) })
      onSaved(res.months)
    } catch {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose} panelStyle={{ maxWidth: 560 }}>
      <ModalHeader title={`Цели автопарка на ${year}`} onClose={onClose} />
      <button className="btn-ghost" style={{ borderRadius: 99, marginBottom: 14 }} onClick={fillFromFirst}>Весь год — как январь</button>
      <div style={{ overflowX: 'auto' }}>
        <table className="plan-edit">
          <thead><tr><th>Месяц</th>{fields.map(([f, l]) => <th key={f}>{l}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, m) => (
              <tr key={m}>
                <td>{MONTHS[m]}</td>
                {fields.map(([f]) => (
                  <td key={f}><input type="number" inputMode="numeric" value={r[f]} onChange={e => set(m, f, e.target.value)}
                    style={{ width: isMobile ? 76 : 104, padding: '6px 8px' }} /></td>
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
