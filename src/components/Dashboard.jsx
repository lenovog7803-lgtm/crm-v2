import { useEffect, useState } from 'react'
import { getDashboard } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'

function Spinner() {
  return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8', fontSize: 14 }}>Загрузка...</div>
}

function LineChart({ points, months }) {
  if (!points || points.length === 0) return <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
  const W = 620, H = 210, PAD = 30
  const vals = points.map(p => (p.cr || 0))
  const maxV = Math.max(...vals, 1)
  const minV = Math.min(...vals) * 0.85
  const n = vals.length
  const xs = vals.map((_, i) => PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2))
  const ys = vals.map(v => H - PAD - ((v - minV) / (maxV - minV || 1)) * (H - PAD * 2))
  const pts = xs.map((x, i) => `${x},${ys[i]}`).join(' ')
  const fillPts = `${xs[0]},${H - PAD} ${pts} ${xs[xs.length - 1]},${H - PAD}`
  const labels = points.map(p => p.d ? p.d.slice(5) : '')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F47A1F" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#F47A1F" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD + t * (H - PAD * 2)
        return <line key={t} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="rgba(14,23,38,0.07)" strokeWidth="1" />
      })}
      <polygon points={fillPts} fill="url(#areaG)" />
      <polyline points={pts} fill="none" stroke="#F47A1F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {xs.map((x, i) => <circle key={i} cx={x} cy={ys[i]} r="4" fill="#F47A1F" stroke="#fff" strokeWidth="2" />)}
      {labels.map((m, i) => (
        <text key={i} x={xs[i]} y={H - 4} textAnchor="middle" fontSize="10" fill="#A6AEB8" fontFamily="Manrope">{m}</text>
      ))}
    </svg>
  )
}

export default function Dashboard({ onNav }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard('month').then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const d = data || {}
  const revenue = d.total_revenue || 0
  const cost = d.total_cost || 0
  const margin = d.total_margin || 0
  const profit = d.profit || 0
  const marginPct = revenue > 0 ? Math.round(margin / revenue * 100) : 0
  const marginChange = d.margin_change_pct
  const activeOrders = d.active_orders || 0
  const deliveredOrders = d.delivered_orders || 0
  const clientsCount = d.clients_count || 0
  const carriersCount = d.carriers_count || 0
  const clientDebt = d.unpaid_by_clients || 0
  const carrierDebt = d.owed_to_carriers || 0
  const debtorsCnt = (d.debtors || []).length
  const creditorsCnt = (d.creditors || []).length
  const chartPoints = d.chart_orders || []
  const topClients = d.top_clients || []
  const topMargin = d.top_clients_margin || []

  return (
    <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>МАРЖА / МЕСЯЦ</div>
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 42, letterSpacing: '-0.03em', lineHeight: 1 }}>{margin.toLocaleString('ru-RU')}</div>
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
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#7A4A12' }}>{clientDebt.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: '#A86A20', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#A86A20', fontWeight: 600 }}>
            {debtorsCnt} · к получению
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
          <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#4A2785' }}>{carrierDebt.toLocaleString('ru-RU')}</div>
          <div style={{ fontSize: 12, color: '#6B3FB8', marginTop: 2 }}>BYN</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#6B3FB8', fontWeight: 600 }}>
            {creditorsCnt} · к выплате
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Активных заявок', value: activeOrders, color: '#1366F0', bg: 'rgba(19,102,240,0.08)' },
          { label: 'Доставлено', value: deliveredOrders, color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)' },
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Выручка за период</div>
            <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>ставки клиентов по дням</div>
          </div>
          {marginChange !== null && marginChange !== undefined && (
            <div style={{ fontSize: 12, color: '#F47A1F', fontWeight: 700, background: 'rgba(244,122,31,0.1)', padding: '4px 12px', borderRadius: 8 }}>
              {marginChange >= 0 ? '+' : ''}{Math.round(marginChange)}% к прошлому периоду
            </div>
          )}
        </div>
        <div style={{ height: 210 }}>
          <LineChart points={chartPoints} />
        </div>
      </div>

      {/* Bottom 2-col */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top by margin */}
        <div className="card" style={{ padding: '20px 20px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Топ по марже</div>
          {topMargin.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topMargin.map((c, i) => {
                const [avA, avB] = getGradient(c.client_name || c.name || '')
                return (
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
                )
              })}
            </div>
          ) : (
            <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
          )}
        </div>

        {/* Top clients */}
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
          ) : (
            <div style={{ color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
          )}
        </div>
      </div>
    </div>
  )
}
