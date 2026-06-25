import { useState, useEffect } from 'react'
import { getDashboard, getOrders } from '../api'
import { initials, getGradient } from '../utils'

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

const fmtMonthLabel = m => {
  if (!m || !m.includes('-')) return m
  const [y, mo] = m.split('-')
  return `${MONTH_RU[parseInt(mo) - 1]} ${y}`
}

const getPrevPeriod = period => {
  if (period === 'month') return 'last_month'
  if (['all', 'quarter', 'year', 'last_month'].includes(period)) return null
  if (/^\d{4}-\d{2}$/.test(period)) {
    const d = new Date(parseInt(period.slice(0, 4)), parseInt(period.slice(5, 7)) - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return null
}

function Chart({ data, prevData, labels, period }) {
  const [hovered, setHovered] = useState(null)
  const W = 800, H = 200, PL = 52, PR = 8, PT = 10, PB = 28

  if (!data || data.length === 0) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>
        Нет данных за период
      </div>
    )
  }

  const safeMax = Math.max(...data, ...(prevData || []), 1)

  const pts = data.map((v, i) => ({
    x: PL + (i / Math.max(data.length - 1, 1)) * (W - PL - PR),
    y: PT + (1 - v / safeMax) * (H - PT - PB),
    v, i,
  }))

  const prevPts = (prevData || []).map((v, i) => ({
    x: PL + (i / Math.max((prevData || []).length - 1, 1)) * (W - PL - PR),
    y: PT + (1 - v / safeMax) * (H - PT - PB),
    v, i,
  }))

  const smooth = points => {
    if (points.length < 2) return points.length === 1 ? `M${points[0].x},${points[0].y}` : ''
    let d = `M${points[0].x},${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const cpx = (points[i - 1].x + points[i].x) / 2
      d += ` C${cpx},${points[i - 1].y} ${cpx},${points[i].y} ${points[i].x},${points[i].y}`
    }
    return d
  }

  const curPath = smooth(pts)
  const prevPath = prevPts.length >= 2 ? smooth(prevPts) : ''

  const isCurrentMonth = period === 'month'
  const todayIdx = isCurrentMonth
    ? Math.min(new Date().getDate() - 1, pts.length - 1)
    : pts.length - 1
  const todayPt = pts[todayIdx] || pts[pts.length - 1]
  const fadeRatio = todayPt ? Math.max(0.02, Math.min(todayPt.x / W, 0.98)) : 1

  const fillPath = curPath + ` L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z`

  const fmtVal = v => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
    return String(Math.round(v))
  }

  const colW = (W - PL - PR) / Math.max(pts.length, 1)

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="dashFillG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1366F0" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1366F0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dashLineG" x1="0" y1="0" x2="1" y2="0">
            <stop offset={`${fadeRatio - 0.01}`} stopColor="#1366F0" stopOpacity="1" />
            <stop offset={`${fadeRatio + 0.01}`} stopColor="#A6AEB8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#A6AEB8" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t, idx) => {
          const y = PT + (1 - t) * (H - PT - PB)
          const val = safeMax * t
          return (
            <g key={idx}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(14,23,38,0.06)" strokeWidth="1" strokeDasharray="4,4" />
              <text x={PL - 6} y={y + 4} fontSize="10" fill="#A6AEB8" textAnchor="end">{fmtVal(val)}</text>
            </g>
          )
        })}

        {prevPath && (
          <path d={prevPath} stroke="#B8C0CC" strokeWidth="1.5" fill="none" strokeDasharray="6,5" strokeLinecap="round" opacity="0.55" />
        )}

        <path d={fillPath} fill="url(#dashFillG)" />
        <path d={curPath} stroke={isCurrentMonth ? 'url(#dashLineG)' : '#1366F0'} strokeWidth="3" fill="none" strokeLinecap="round" />

        {todayPt && <>
          <circle cx={todayPt.x} cy={todayPt.y} r="12" fill="#1366F0" opacity="0.08" />
          <circle cx={todayPt.x} cy={todayPt.y} r="6" fill="#1366F0" opacity="0.15" />
          <circle cx={todayPt.x} cy={todayPt.y} r="4" fill="#1366F0" />
          <circle cx={todayPt.x} cy={todayPt.y} r="2" fill="#fff" />
        </>}

        {hovered !== null && pts[hovered] && <>
          <line x1={pts[hovered].x} y1={PT} x2={pts[hovered].x} y2={H - PB} stroke="#1366F0" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
          <circle cx={pts[hovered].x} cy={pts[hovered].y} r="10" fill="#1366F0" opacity="0.12" />
          <circle cx={pts[hovered].x} cy={pts[hovered].y} r="5" fill="#1366F0" />
          <circle cx={pts[hovered].x} cy={pts[hovered].y} r="2.5" fill="#fff" />
        </>}

        {pts.map((pt, i) => (
          <rect key={i}
            x={pt.x - colW / 2} y={0} width={colW} height={H}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>

      {hovered !== null && pts[hovered] && (
        <div style={{
          position: 'absolute',
          left: `${Math.max(5, Math.min(pts[hovered].x / W * 100 - 9, 68))}%`,
          top: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderRadius: 13,
          padding: '10px 14px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 16px 40px rgba(20,30,55,0.18)',
          pointerEvents: 'none',
          minWidth: 150,
          zIndex: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', marginBottom: 6 }}>
            {labels[hovered]}
          </div>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 17, color: '#0E1726' }}>
            {pts[hovered].v.toLocaleString('ru-RU')} Br
          </div>
          {prevData && prevData[hovered] !== undefined && prevData[hovered] > 0 && (
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 3 }}>
              прошлый: {prevData[hovered].toLocaleString('ru-RU')} Br
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PL, paddingRight: PR, marginTop: 2 }}>
        {labels.map((l, i) => {
          const step = Math.ceil(labels.length / 8)
          if (i % step !== 0 && i !== labels.length - 1) return null
          return <span key={i} style={{ fontSize: 10, color: '#8A93A0' }}>{l}</span>
        })}
      </div>
    </div>
  )
}

export default function Dashboard({ onNav }) {
  const [data, setData] = useState(null)
  const [prevApiData, setPrevApiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [availableMonths, setAvailableMonths] = useState([])
  const [allOrders, setAllOrders] = useState([])

  // Fetch all orders once for month picker + local chart computation
  useEffect(() => {
    getOrders({ limit: 2000 }).then(r => {
      const arr = Array.isArray(r) ? r : []
      setAllOrders(arr)
      const months = [
        ...new Set(arr.map(o => (o.load_date || '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m))),
      ].sort().reverse()
      setAvailableMonths(months)
    }).catch(() => {})
  }, [])

  // Fetch dashboard stats for selected period
  useEffect(() => {
    setLoading(true)
    const isCustomMonth = /^\d{4}-\d{2}$/.test(period)
    // For custom months pass the month to API (may not be supported — fallback via getStats())
    getDashboard(period).then(d => {
      setData(d)
      const prev = getPrevPeriod(period)
      if (prev && !isCustomMonth) {
        getDashboard(prev).then(pd => setPrevApiData(pd)).catch(() => setPrevApiData(null))
      } else {
        setPrevApiData(null)
      }
    }).catch(() => setData(null)).finally(() => setLoading(false))
  }, [period])

  const getChartData = () => {
    const isCustomMonth = /^\d{4}-\d{2}$/.test(period)

    if (isCustomMonth && allOrders.length > 0) {
      const [y, mo] = period.split('-').map(Number)
      const daysInMonth = new Date(y, mo, 0).getDate()
      const byDay = {}
      allOrders.filter(o => (o.load_date || '').slice(0, 7) === period).forEach(o => {
        const d = parseInt((o.load_date || '').slice(8, 10) || '0')
        if (d >= 1) byDay[d] = (byDay[d] || 0) + (o.client_rate || 0)
      })
      const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      const curData = days.map(d => byDay[d] || 0)
      const labels = days.map(d => `${d}.${String(mo).padStart(2, '0')}`)

      const prevMonthDate = new Date(y, mo - 2, 1)
      const prevKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`
      const prevByDay = {}
      allOrders.filter(o => (o.load_date || '').slice(0, 7) === prevKey).forEach(o => {
        const d = parseInt((o.load_date || '').slice(8, 10) || '0')
        if (d >= 1) prevByDay[d] = (prevByDay[d] || 0) + (o.client_rate || 0)
      })
      const prevDays = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate()
      const prev = Array.from({ length: prevDays }, (_, i) => prevByDay[i + 1] || 0).slice(0, daysInMonth)

      return { curData, prev, labels }
    }

    if (period === 'all' && allOrders.length > 0) {
      const byMonth = {}
      allOrders.forEach(o => {
        const m = (o.load_date || '').slice(0, 7)
        if (/^\d{4}-\d{2}$/.test(m)) byMonth[m] = (byMonth[m] || 0) + (o.client_rate || 0)
      })
      const months = Object.keys(byMonth).sort()
      return {
        curData: months.map(m => byMonth[m]),
        prev: [],
        labels: months.map(m => {
          const [y2, mo2] = m.split('-')
          return MONTH_RU[parseInt(mo2) - 1].slice(0, 3) + " '" + y2.slice(2)
        }),
      }
    }

    const chartPoints = data?.chart_orders || []
    const curData = chartPoints.map(p => p.cr || 0)
    const prevChartPoints = prevApiData?.chart_orders || []
    const prev = prevChartPoints.map(p => p.cr || 0)
    const labels = chartPoints.map(p => p.d ? p.d.slice(5) : '')
    return { curData, prev, labels }
  }

  const getStats = () => {
    const isCustomMonth = /^\d{4}-\d{2}$/.test(period)
    if (!isCustomMonth || allOrders.length === 0) return data || {}

    const filtered = allOrders.filter(o => (o.load_date || '').slice(0, 7) === period)
    const revenue = filtered.reduce((s, o) => s + (o.client_rate || 0), 0)
    const cost = filtered.reduce((s, o) => s + (o.carrier_rate || 0), 0)
    const margin = revenue - cost

    return {
      total_revenue: revenue, total_cost: cost, total_margin: margin, profit: margin,
      margin_change_pct: null,
      active_orders: filtered.filter(o => ['new', 'in_progress'].includes(o.status)).length,
      delivered_orders: filtered.filter(o => o.status === 'delivered').length,
      clients_count: data?.clients_count || 0,
      carriers_count: data?.carriers_count || 0,
      unpaid_by_clients: filtered.filter(o => !o.client_paid).reduce((s, o) => s + (o.client_rate || 0), 0),
      owed_to_carriers: filtered.filter(o => !o.carrier_paid).reduce((s, o) => s + (o.carrier_rate || 0), 0),
      debtors: [], creditors: [],
      top_clients: data?.top_clients || [],
      top_clients_margin: data?.top_clients_margin || [],
    }
  }

  const d = getStats()
  const { curData, prev: prevChartData, labels } = getChartData()

  const revenue = d.total_revenue || 0
  const margin = d.total_margin || 0
  const profit = d.profit || 0
  const marginChange = d.margin_change_pct
  const clientDebt = d.unpaid_by_clients || 0
  const carrierDebt = d.owed_to_carriers || 0
  const topClients = d.top_clients || []
  const topMargin = d.top_clients_margin || []

  // Build period options: fixed presets + all months from DB (deduped)
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const fixedPeriods = [
    { value: 'month', label: 'Этот месяц' },
    { value: 'last_month', label: 'Прошлый месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year', label: 'Год' },
    { value: 'all', label: 'Всё время' },
  ]
  const fixedValues = new Set(['month', 'last_month', 'quarter', 'year', 'all', currentMonthKey, lastMonthKey])
  const monthOptions = availableMonths
    .filter(m => !fixedValues.has(m))
    .map(m => ({ value: m, label: fmtMonthLabel(m) }))

  return (
    <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Period selector */}
      <div className="card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#A6AEB8', fontWeight: 600, letterSpacing: '0.06em' }}>ПЕРИОД</span>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{
            height: 36, padding: '0 28px 0 12px', borderRadius: 10,
            border: '1px solid rgba(14,23,38,0.12)',
            background: 'rgba(255,255,255,0.8)',
            fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, color: '#0E1726',
            outline: 'none', cursor: 'pointer', minWidth: 180,
            appearance: 'auto',
          }}
        >
          {fixedPeriods.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          {monthOptions.length > 0 && <option disabled>──────────────</option>}
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: '#A6AEB8' }}>Загрузка...</span>}
      </div>

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gap: 16 }}>
        {/* Dark hero */}
        <div style={{
          background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
          borderRadius: 22, padding: '28px 28px', color: '#fff',
          boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(19,102,240,0.15)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>МАРЖА</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 42, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {margin.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
          {marginChange !== null && marginChange !== undefined && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, background: marginChange >= 0 ? 'rgba(30,158,90,0.2)' : 'rgba(200,25,35,0.2)', borderRadius: 8, padding: '4px 10px' }}>
              <span style={{ color: marginChange >= 0 ? '#1E9E5A' : '#C81923', fontSize: 12, fontWeight: 700 }}>
                {marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}%
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Выручка</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{revenue.toLocaleString('ru-RU')} BYN</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Прибыль</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#5BE89B' }}>{profit.toLocaleString('ru-RU')} BYN</div>
            </div>
          </div>
        </div>

        {/* Orange - client debt */}
        <div
          onClick={() => onNav('finance')}
          style={{
            background: 'linear-gradient(135deg, rgba(255,236,214,0.95), rgba(255,213,170,0.85))',
            borderRadius: 22, padding: '28px 24px',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 16px 40px -16px rgba(217,119,6,0.4)',
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#A86A20', marginBottom: 8 }}>ОЖИДАЕТСЯ ОТ КЛИЕНТОВ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#7A4A12' }}>
            {clientDebt.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: '#A86A20', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#A86A20', fontWeight: 600 }}>
            {(d.debtors || []).length} · к получению
          </div>
        </div>

        {/* Purple - carrier debt */}
        <div
          onClick={() => onNav('finance')}
          style={{
            background: 'linear-gradient(135deg, rgba(224,224,255,0.95), rgba(208,191,255,0.85))',
            borderRadius: 22, padding: '28px 24px',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 16px 40px -16px rgba(124,58,237,0.4)',
            cursor: 'pointer', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#6B3FB8', marginBottom: 8 }}>К ОПЛАТЕ ПЕРЕВОЗЧИКАМ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#4A2785' }}>
            {carrierDebt.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: '#6B3FB8', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#6B3FB8', fontWeight: 600 }}>
            {(d.creditors || []).length} · к выплате
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Активных заявок', value: d.active_orders || 0, color: '#1366F0', bg: 'rgba(19,102,240,0.08)' },
          { label: 'Доставлено', value: d.delivered_orders || 0, color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)' },
          { label: 'Клиентов', value: d.clients_count || 0, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
          { label: 'Перевозчиков', value: d.carriers_count || 0, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
        ].map(kpi => (
          <div key={kpi.label} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{kpi.label}</div>
            <div style={{
              fontFamily: 'Onest', fontWeight: 800, fontSize: 36, color: kpi.color,
              background: kpi.bg, borderRadius: 12, padding: '8px 14px', display: 'inline-block', lineHeight: 1,
            }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card" style={{ padding: '24px 24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Выручка</div>
            <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>ставки клиентов</div>
          </div>
          {prevChartData && prevChartData.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 2, background: '#B8C0CC', borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600 }}>прошлый период</span>
            </div>
          )}
          {marginChange !== null && marginChange !== undefined && (
            <div style={{ fontSize: 12, color: '#1366F0', fontWeight: 700, background: 'rgba(19,102,240,0.08)', padding: '4px 12px', borderRadius: 8 }}>
              {marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}% к прошлому
            </div>
          )}
        </div>
        <Chart data={curData} prevData={prevChartData} labels={labels} period={period} />
      </div>

      {/* Bottom 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Топ по марже</div>
          {topMargin.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topMargin.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'rgba(30,158,90,0.12)', color: '#1E9E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_name || c.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E9E5A' }}>{(c.margin || 0).toLocaleString('ru-RU')} BYN</div>
                    <div style={{ fontSize: 11, color: '#A6AEB8' }}>{c.margin_pct !== undefined ? Math.round(c.margin_pct) + '%' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>}
        </div>

        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Топ клиентов</div>
          {topClients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topClients.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: 'rgba(19,102,240,0.1)', color: '#1366F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.client_name || c.name}</div>
                    <div style={{ fontSize: 11, color: '#A6AEB8' }}>{c.orders_count} заявок</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1366F0' }}>{(c.revenue || c.total_revenue || 0).toLocaleString('ru-RU')} BYN</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>}
        </div>
      </div>
    </div>
  )
}
