import { useState, useEffect } from 'react'
import { getDashboard, getOrders } from '../api'

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTH_RU_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']

const fmtMonthLabel = m => {
  if (!m || !m.includes('-')) return m
  const [y, mo] = m.split('-')
  return `${MONTH_RU[parseInt(mo) - 1]} ${y}`
}

function filterByPeriod(orders, period) {
  const now = new Date()
  return orders.filter(o => {
    const raw = o.load_date || o.unload_date || o.created_at
    if (!raw) return period === 'all'
    const d = new Date(raw)
    if (isNaN(d)) return period === 'all'
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear()
    }
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3)
      return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear()
    }
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    if (/^\d{4}-\d{2}$/.test(period)) return (raw || '').slice(0, 7) === period
    return true
  })
}

function getPrevPeriod(period) {
  if (period === 'month') return 'last_month'
  if (period === 'last_month' || period === 'all' || period === 'quarter' || period === 'year') return null
  if (/^\d{4}-\d{2}$/.test(period)) {
    const d = new Date(parseInt(period.slice(0, 4)), parseInt(period.slice(5, 7)) - 2, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return null
}

function calcStats(orders, period, apiData) {
  const filtered = period === 'all' ? orders : filterByPeriod(orders, period)
  const revenue = filtered.reduce((s, o) => s + (o.client_rate || 0), 0)
  const cost = filtered.reduce((s, o) => s + (o.carrier_rate || 0), 0)
  const margin = revenue - cost

  const allDone = orders.filter(o => o.status === 'done' || o.status === 'delivered' || o.status === 'completed')
  const clientDebt = allDone.filter(o => !o.client_paid).reduce((s, o) => s + (o.client_rate || 0), 0)
  const carrierDebt = allDone.filter(o => !o.carrier_paid).reduce((s, o) => s + (o.carrier_rate || 0), 0)

  const active = orders.filter(o => ['new', 'in_progress', 'loading', 'in_transit'].includes(o.status)).length
  const done = orders.filter(o => ['done', 'delivered', 'completed'].includes(o.status)).length

  // Top clients by revenue in period
  const clientMap = {}
  filtered.forEach(o => {
    const key = o.client_name || (o.client_id ? `ID:${o.client_id}` : null)
    if (!key) return
    if (!clientMap[key]) clientMap[key] = { name: key, rev: 0, cost: 0, cnt: 0 }
    clientMap[key].rev += o.client_rate || 0
    clientMap[key].cost += o.carrier_rate || 0
    clientMap[key].cnt++
  })
  const topClients = Object.values(clientMap).sort((a, b) => b.rev - a.rev).slice(0, 6)
  const topByMargin = Object.values(clientMap)
    .filter(c => c.rev > 0)
    .map(c => ({ ...c, pct: (c.rev - c.cost) / c.rev * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6)

  // Debtor orders
  const debtorOrders = allDone.filter(o => !o.client_paid && (o.client_rate || 0) > 0)
  const carrierDebtOrders = allDone.filter(o => !o.carrier_paid && (o.carrier_rate || 0) > 0)

  // Group debtors by client
  const debtorMap = {}
  debtorOrders.forEach(o => {
    const key = o.client_name || `ID:${o.client_id}`
    if (!debtorMap[key]) debtorMap[key] = { name: key, amt: 0 }
    debtorMap[key].amt += o.client_rate || 0
  })
  const topDebtors = Object.values(debtorMap).sort((a, b) => b.amt - a.amt).slice(0, 6)

  // Prefer locally computed counts (from all fetched orders) — API often returns 0 for these
  const activeOrders = active || apiData?.active_orders || 0
  const deliveredOrders = done || apiData?.delivered_orders || 0
  const clientsCount = apiData?.clients_count || 0
  const carriersCount = apiData?.carriers_count || 0

  return {
    revenue, cost, margin,
    clientDebt, carrierDebt,
    active: activeOrders, done: deliveredOrders,
    clientsCount, carriersCount,
    topClients: apiData?.top_clients?.length ? apiData.top_clients : topClients,
    topByMargin: apiData?.top_clients_margin?.length ? apiData.top_clients_margin : topByMargin,
    topDebtors,
    debtorOrders,
    carrierDebtOrders,
  }
}

function buildChartData(orders, period) {
  const now = new Date()

  if (period === 'month' || period === 'last_month' || /^\d{4}-\d{2}$/.test(period)) {
    let year = now.getFullYear(), mo = now.getMonth()
    if (period === 'last_month') { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); year = d.getFullYear(); mo = d.getMonth() }
    else if (/^\d{4}-\d{2}$/.test(period)) { year = parseInt(period.slice(0, 4)); mo = parseInt(period.slice(5, 7)) - 1 }

    const key = `${year}-${String(mo + 1).padStart(2, '0')}`
    const daysInMonth = new Date(year, mo + 1, 0).getDate()
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    const byDay = {}
    orders.filter(o => (o.load_date || o.unload_date || '').slice(0, 7) === key).forEach(o => {
      const dateStr = o.load_date || o.unload_date || ''
      const d = parseInt(dateStr.slice(8, 10))
      if (d >= 1) byDay[d] = (byDay[d] || 0) + ((o.client_rate || 0) - (o.carrier_rate || 0))
    })

    const prevMo = mo - 1
    const prevYear = prevMo < 0 ? year - 1 : year
    const prevMoNorm = ((prevMo % 12) + 12) % 12
    const prevKey = `${prevYear}-${String(prevMoNorm + 1).padStart(2, '0')}`
    const prevByDay = {}
    orders.filter(o => (o.load_date || o.unload_date || '').slice(0, 7) === prevKey).forEach(o => {
      const dateStr = o.load_date || o.unload_date || ''
      const d = parseInt(dateStr.slice(8, 10))
      if (d >= 1) prevByDay[d] = (prevByDay[d] || 0) + ((o.client_rate || 0) - (o.carrier_rate || 0))
    })

    return {
      current: days.map(d => byDay[d] || 0),
      prev: days.map(d => prevByDay[d] || 0),
      labels: days.map(String),
      mode: 'days',
      month: mo,
    }
  }

  if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3
    const months = Array.from({ length: 3 }, (_, i) => qStart + i)
    const byMonth = {}; const prevByMonth = {}
    orders.forEach(o => {
      const dateStr = o.load_date || o.unload_date || ''
      if (!dateStr) return
      const d = new Date(dateStr)
      if (isNaN(d)) return
      const key = d.getMonth()
      const val = (o.client_rate || 0) - (o.carrier_rate || 0)
      if (d.getFullYear() === now.getFullYear()) byMonth[key] = (byMonth[key] || 0) + val
      else if (d.getFullYear() === now.getFullYear() - 1) prevByMonth[key] = (prevByMonth[key] || 0) + val
    })
    return {
      current: months.map(m => byMonth[m] || 0),
      prev: months.map(m => prevByMonth[m] || 0),
      labels: months.map(m => MONTH_RU_SHORT[m]),
      mode: 'months',
    }
  }

  if (period === 'year') {
    const byMonth = {}; const prevByMonth = {}
    orders.forEach(o => {
      const dateStr = o.load_date || o.unload_date || ''
      if (!dateStr) return
      const d = new Date(dateStr)
      if (isNaN(d)) return
      const val = (o.client_rate || 0) - (o.carrier_rate || 0)
      if (d.getFullYear() === now.getFullYear()) byMonth[d.getMonth()] = (byMonth[d.getMonth()] || 0) + val
      else if (d.getFullYear() === now.getFullYear() - 1) prevByMonth[d.getMonth()] = (prevByMonth[d.getMonth()] || 0) + val
    })
    return {
      current: Array.from({ length: 12 }, (_, m) => byMonth[m] || 0),
      prev: Array.from({ length: 12 }, (_, m) => prevByMonth[m] || 0),
      labels: MONTH_RU_SHORT,
      mode: 'months',
    }
  }

  // all — by month
  const byMonth = {}
  orders.forEach(o => {
    const dateStr = o.load_date || o.unload_date || ''
    if (!dateStr) return
    const m = dateStr.slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(m)) return
    byMonth[m] = (byMonth[m] || 0) + ((o.client_rate || 0) - (o.carrier_rate || 0))
  })
  const months = Object.keys(byMonth).sort()
  return {
    current: months.map(m => byMonth[m]),
    prev: [],
    labels: months.map(m => MONTH_RU_SHORT[parseInt(m.slice(5, 7)) - 1] + " '" + m.slice(2, 4)),
    mode: 'months',
  }
}

function ChartSVG({ current, prev, labels, mode, todayIdx }) {
  const [hovered, setHovered] = useState(null)
  const W = 800, H = 200, PL = 52, PR = 8, PT = 10, PB = 28

  if (!current || current.length === 0) {
    return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
  }

  const safeMax = Math.max(...current, ...(prev || []), 1)

  const pts = current.map((v, i) => ({
    x: PL + (i / Math.max(current.length - 1, 1)) * (W - PL - PR),
    y: PT + (1 - Math.max(0, v) / safeMax) * (H - PT - PB),
    v, i,
  }))
  const prevPts = (prev || []).map((v, i) => ({
    x: PL + (i / Math.max((prev || []).length - 1, 1)) * (W - PL - PR),
    y: PT + (1 - Math.max(0, v) / safeMax) * (H - PT - PB),
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
  const todayPt = pts[todayIdx !== undefined ? Math.min(todayIdx, pts.length - 1) : pts.length - 1]
  const fadeRatio = todayPt ? Math.max(0.02, Math.min(todayPt.x / W, 0.98)) : 1
  const fillPath = curPath + ` L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z`
  const colW = (W - PL - PR) / Math.max(pts.length, 1)

  const fmtVal = v => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`
    return String(Math.round(v))
  }

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id="dashFillG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1366F0" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1366F0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="dashLineG" x1="0" y1="0" x2="1" y2="0">
            <stop offset={`${Math.max(0, fadeRatio - 0.01)}`} stopColor="#1366F0" stopOpacity="1" />
            <stop offset={`${Math.min(1, fadeRatio + 0.01)}`} stopColor="#A6AEB8" stopOpacity="0.35" />
            <stop offset="1" stopColor="#A6AEB8" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((t, idx) => {
          const y = PT + (1 - t) * (H - PT - PB)
          return (
            <g key={idx}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(14,23,38,0.06)" strokeWidth="1" strokeDasharray="4,4" />
              <text x={PL - 6} y={y + 4} fontSize="10" fill="#A6AEB8" textAnchor="end">{fmtVal(safeMax * t)}</text>
            </g>
          )
        })}

        {prevPath && <path d={prevPath} stroke="#B8C0CC" strokeWidth="1.5" fill="none" strokeDasharray="6,5" strokeLinecap="round" opacity="0.55" />}
        <path d={fillPath} fill="url(#dashFillG)" />
        <path d={curPath} stroke={mode === 'days' ? 'url(#dashLineG)' : '#1366F0'} strokeWidth="3" fill="none" strokeLinecap="round" />

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
          <rect key={i} x={pt.x - colW / 2} y={0} width={colW} height={H}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} />
        ))}
      </svg>

      {hovered !== null && pts[hovered] && (
        <div style={{
          position: 'absolute',
          left: `${Math.max(2, Math.min(pts[hovered].x / W * 100 - 9, 68))}%`,
          top: 0,
          background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
          borderRadius: 13, padding: '10px 14px',
          border: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 16px 40px rgba(20,30,55,0.18)',
          pointerEvents: 'none', minWidth: 150, zIndex: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', marginBottom: 6 }}>{labels[hovered]}</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 17, color: '#0E1726' }}>
            {pts[hovered].v.toLocaleString('ru-RU')} Br
          </div>
          {prev && prev[hovered] !== undefined && prev[hovered] > 0 && (
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 3 }}>прошлый: {prev[hovered].toLocaleString('ru-RU')} Br</div>
          )}
          {prev && prev[hovered] > 0 && (
            <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: pts[hovered].v >= prev[hovered] ? '#1E9E5A' : '#C81923' }}>
              {pts[hovered].v >= prev[hovered] ? '+' : ''}{Math.round((pts[hovered].v - prev[hovered]) / prev[hovered] * 100)}%
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PL, paddingRight: PR, marginTop: 2 }}>
        {labels.map((l, i) => {
          const step = Math.ceil(labels.length / 8)
          if (i % step !== 0 && i !== labels.length - 1) return null
          return <span key={i} style={{ fontSize: 10, color: '#A6AEB8' }}>{l}</span>
        })}
      </div>
    </div>
  )
}

function DebtModal({ title, orders, onClose, onOpenOrder }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.45)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)', borderRadius: 24, padding: 28, maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 40px 80px rgba(20,30,55,0.3)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 18, color: '#0E1726' }}>{title}</div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(14,23,38,0.1)', background: 'transparent', cursor: 'pointer', fontSize: 20, color: '#8A93A0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        {orders.length === 0 && <div style={{ color: '#A6AEB8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Нет неоплаченных заявок</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {orders.map((o, i) => (
            <div key={i}
              onClick={() => { onOpenOrder && onOpenOrder(o.id); onClose() }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 12, borderBottom: '1px solid rgba(14,23,38,0.06)', cursor: onOpenOrder ? 'pointer' : 'default', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(19,102,240,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0', fontWeight: 600 }}>{o.order_number || `#${o.id}`}</div>
                <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.client_name || o.carrier_name || '—'}{(o.route_from && o.route_to) ? ` · ${o.route_from} → ${o.route_to}` : ''}
                </div>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 700, color: '#D97706', flexShrink: 0, marginLeft: 12 }}>
                {(o.client_rate || o.carrier_rate || 0).toLocaleString('ru-RU')} Br
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ onNav, onOpenOrder, period = 'month', onMonthsLoaded }) {
  const [allOrders, setAllOrders] = useState([])
  const [apiData, setApiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showDebtors, setShowDebtors] = useState(false)
  const [showCarrierDebt, setShowCarrierDebt] = useState(false)

  // Load all orders once
  useEffect(() => {
    getOrders({ limit: 2000 }).then(r => {
      const arr = Array.isArray(r) ? r : (r?.orders || r?.data || [])
      setAllOrders(arr)
      const months = [...new Set(
        arr.map(o => (o.load_date || o.unload_date || '').slice(0, 7)).filter(m => /^\d{4}-\d{2}$/.test(m))
      )].sort().reverse()
      onMonthsLoaded && onMonthsLoaded(months)
    }).catch(() => {})
  }, [])

  // Fetch API dashboard when period changes
  useEffect(() => {
    setLoading(true)
    getDashboard(period).then(d => setApiData(d)).catch(() => setApiData(null)).finally(() => setLoading(false))
  }, [period])

  const stats = calcStats(allOrders, period, apiData)
  const chart = buildChartData(allOrders, period)
  const todayIdx = chart.mode === 'days' ? Math.min(new Date().getDate() - 1, chart.current.length - 1) : chart.current.length - 1

  const { revenue, cost, margin, clientDebt, carrierDebt, active, done, clientsCount, carriersCount,
    topClients, topByMargin, topDebtors, debtorOrders, carrierDebtOrders } = stats

  const prevPeriodKey = getPrevPeriod(period)
  const prevStats = prevPeriodKey ? calcStats(allOrders, prevPeriodKey, null) : null
  const marginDiff = prevStats && prevStats.margin !== 0
    ? Math.round(((margin - prevStats.margin) / Math.abs(prevStats.margin)) * 100)
    : null
  const marginUp = marginDiff !== null && marginDiff >= 0

  const netProfit = margin * 0.85

  return (
    <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 16 }}>
        {/* Dark: margin */}
        <div style={{
          background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
          borderRadius: 22, padding: '28px 28px', color: '#fff',
          boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(19,102,240,0.15)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)' }}>МАРЖА</div>
            {marginDiff !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 8px', borderRadius: 20,
                background: marginUp ? 'rgba(91,232,155,0.18)' : 'rgba(200,25,35,0.22)',
                fontSize: 11, fontWeight: 700,
                color: marginUp ? '#5BE89B' : '#FF6B7A',
              }}>
                <span>{marginUp ? '▲' : '▼'}</span>
                <span>{Math.abs(marginDiff)}%</span>
                <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 10 }}>vs пред.</span>
              </div>
            )}
          </div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 40, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {margin.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>BYN</div>
          <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Выручка</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{revenue.toLocaleString('ru-RU')} BYN</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Чистая прибыль</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#5BE89B' }}>{Math.round(netProfit).toLocaleString('ru-RU')} BYN</div>
            </div>
          </div>
        </div>

        {/* Orange: client debt */}
        <div
          onClick={() => setShowDebtors(true)}
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
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#7A4A12' }}>
            {clientDebt.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: '#A86A20', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#A86A20', fontWeight: 600 }}>
            {debtorOrders.length} заявок · нажмите →
          </div>
        </div>

        {/* Purple: carrier debt */}
        <div
          onClick={() => setShowCarrierDebt(true)}
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
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', color: '#4A2785' }}>
            {carrierDebt.toLocaleString('ru-RU')}
          </div>
          <div style={{ fontSize: 12, color: '#6B3FB8', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12, color: '#6B3FB8', fontWeight: 600 }}>
            {carrierDebtOrders.length} заявок · нажмите →
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Активных заявок', value: active, color: '#1366F0', bg: 'rgba(19,102,240,0.08)' },
          { label: 'Доставлено', value: done, color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)' },
          { label: 'Клиентов', value: clientsCount, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
          { label: 'Перевозчиков', value: carriersCount, color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
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
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Маржа</div>
            <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>ставка клиента − ставка перевозчика</div>
          </div>
          {chart.prev && chart.prev.length > 0 && chart.prev.some(v => v > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 2, background: '#B8C0CC', borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600 }}>прошлый период</span>
            </div>
          )}
        </div>
        <ChartSVG
          current={chart.current}
          prev={chart.prev}
          labels={chart.labels}
          mode={chart.mode}
          todayIdx={todayIdx}
        />
      </div>

      {/* Bottom 3-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {/* Top clients */}
        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 4 }}>Топ клиентов</div>
          <div style={{ fontSize: 12, color: '#A6AEB8', marginBottom: 14 }}>по выручке за период</div>
          {topClients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {topClients.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: 'rgba(19,102,240,0.1)', color: '#1366F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || c.client_name}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 600, color: '#1366F0', flexShrink: 0 }}>
                    {Math.round(c.rev || c.revenue || c.total_revenue || 0).toLocaleString('ru-RU')} Br
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>}
        </div>

        {/* Top by margin */}
        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 4 }}>Топ по марже</div>
          <div style={{ fontSize: 12, color: '#A6AEB8', marginBottom: 14 }}>% маржинальности</div>
          {topByMargin.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {topByMargin.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, background: 'rgba(30,158,90,0.1)', color: '#1E9E5A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name || c.client_name}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#1E9E5A', flexShrink: 0 }}>
                    {(c.pct || c.margin_pct || 0).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>}
        </div>

        {/* Debtors */}
        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 4 }}>Должники</div>
          <div style={{ fontSize: 12, color: '#A6AEB8', marginBottom: 14 }}>неоплаченные доставки</div>
          {topDebtors.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {topDebtors.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(217,119,6,0.12)', color: '#D97706', flexShrink: 0, fontFamily: 'Onest', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(c.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, fontWeight: 700, color: '#D97706', flexShrink: 0 }}>
                    {Math.round(c.amt).toLocaleString('ru-RU')} Br
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет должников</div>}
        </div>
      </div>

      {/* Modals */}
      {showDebtors && (
        <DebtModal
          title="Ожидается от клиентов"
          orders={debtorOrders}
          onClose={() => setShowDebtors(false)}
          onOpenOrder={onOpenOrder}
        />
      )}
      {showCarrierDebt && (
        <DebtModal
          title="К оплате перевозчикам"
          orders={carrierDebtOrders.map(o => ({ ...o, client_rate: o.carrier_rate }))}
          onClose={() => setShowCarrierDebt(false)}
          onOpenOrder={onOpenOrder}
        />
      )}
    </div>
  )
}
