import { useState, useEffect, useRef } from 'react'
import { getOrders, deleteOrder as apiDelete } from '../api'
import { initials, statusLabel, statusColor, statusBg, getGradient } from '../utils'

const DOC_FILTER_OPTIONS = [
  { key: 'docs_to_client_sent', label: 'Отправлены клиенту' },
  { key: 'docs_from_client_received', label: 'Получены от клиента' },
  { key: 'docs_to_carrier_sent', label: 'Отправлены перевозчику' },
  { key: 'docs_from_carrier_received', label: 'Получены от перевозчика' },
]

export default function Orders({ onOpenOrder, onAddOrder, refreshKey, search = '' }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [payFilter, setPayFilter] = useState(null)
  const [docFilters, setDocFilters] = useState([])
  const [showDocFilter, setShowDocFilter] = useState(false)
  const docBtnRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    getOrders()
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Close doc filter on outside click
  useEffect(() => {
    if (!showDocFilter) return
    const handler = e => {
      if (docBtnRef.current && !docBtnRef.current.contains(e.target)) {
        setShowDocFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDocFilter])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await apiDelete(id).catch(console.error)
    setOrders(prev => prev.filter(o => o.id !== id))
  }

  const toggleDocFilter = key => {
    setDocFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const statusChips = [
    { key: 'all', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'in_progress', label: 'В пути' },
    { key: 'delivered', label: 'Выполнено' },
    { key: 'cancelled', label: 'Отменено' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = o => o.unload_date && o.unload_date < today && o.status !== 'done' && o.status !== 'cancelled'

  let filtered = [...orders]
  if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter)
  if (payFilter === 'clientUnpaid') filtered = filtered.filter(o => !o.client_paid)
  if (payFilter === 'carrierUnpaid') filtered = filtered.filter(o => !o.carrier_paid)
  if (payFilter === 'debt') filtered = filtered.filter(o => o.client_paid && !o.carrier_paid)
  if (docFilters.length > 0) filtered = filtered.filter(o => docFilters.every(f => o[f]))
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(o =>
      (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
      (o.client_name && o.client_name.toLowerCase().includes(q)) ||
      (o.carrier_name && o.carrier_name.toLowerCase().includes(q)) ||
      (o.route_from && o.route_from.toLowerCase().includes(q)) ||
      (o.route_to && o.route_to.toLowerCase().includes(q)) ||
      (o.cargo && o.cargo.toLowerCase().includes(q))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {statusChips.map(c => (
            <button key={c.key} onClick={() => setStatusFilter(c.key)} style={{
              padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
              background: statusFilter === c.key ? '#0E1726' : 'rgba(14,23,38,0.06)',
              color: statusFilter === c.key ? '#fff' : '#5A6573', transition: 'all 0.15s',
            }}>{c.label}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(14,23,38,0.1)', margin: '0 2px' }} />
        <button onClick={() => setPayFilter(payFilter === 'clientUnpaid' ? null : 'clientUnpaid')} style={{
          padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
          fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
          background: payFilter === 'clientUnpaid' ? 'rgba(30,158,90,0.15)' : 'rgba(14,23,38,0.06)',
          color: payFilter === 'clientUnpaid' ? '#1E9E5A' : '#5A6573',
        }}>Не оплачено клиентом</button>
        <button onClick={() => setPayFilter(payFilter === 'carrierUnpaid' ? null : 'carrierUnpaid')} style={{
          padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
          fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
          background: payFilter === 'carrierUnpaid' ? 'rgba(124,58,237,0.15)' : 'rgba(14,23,38,0.06)',
          color: payFilter === 'carrierUnpaid' ? '#7C3AED' : '#5A6573',
        }}>Не оплачено перевозчику</button>
        <div style={{ flex: 1 }} />

        {/* Doc filter */}
        <div ref={docBtnRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowDocFilter(v => !v)} style={{
            padding: '7px 14px', borderRadius: 12, cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: docFilters.length > 0 ? 'rgba(19,102,240,0.12)' : 'rgba(14,23,38,0.06)',
            color: docFilters.length > 0 ? '#1366F0' : '#5A6573',
            border: docFilters.length > 0 ? '1px solid rgba(19,102,240,0.3)' : '1px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Документы {docFilters.length > 0 && `(${docFilters.length})`}
          </button>
          {showDocFilter && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 6,
              background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)',
              borderRadius: 16, padding: '8px 4px',
              border: '1px solid rgba(255,255,255,0.9)',
              boxShadow: '0 20px 60px rgba(20,30,55,0.15)', zIndex: 9999, minWidth: 250,
            }}>
              {DOC_FILTER_OPTIONS.map(f => (
                <label key={f.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer', borderRadius: 10,
                  fontSize: 13, fontWeight: 600, color: '#0E1726',
                  background: docFilters.includes(f.key) ? 'rgba(19,102,240,0.07)' : 'transparent',
                  transition: 'background 0.12s',
                }}>
                  <input
                    type="checkbox"
                    checked={docFilters.includes(f.key)}
                    onChange={() => toggleDocFilter(f.key)}
                    style={{ accentColor: '#1366F0', width: 15, height: 15 }}
                  />
                  {f.label}
                </label>
              ))}
              {docFilters.length > 0 && (
                <button onClick={() => setDocFilters([])} style={{
                  width: '100%', padding: '8px 14px', border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.07)', color: '#C81923',
                  fontFamily: 'Manrope', fontSize: 12, fontWeight: 600, borderRadius: 10, marginTop: 4,
                }}>Сбросить фильтр</button>
              )}
            </div>
          )}
        </div>

        {/* Долг перевозчику */}
        <button onClick={() => setPayFilter(payFilter === 'debt' ? null : 'debt')} title="Долг перевозчику: клиент оплатил, перевозчику нет" style={{
          width: 34, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: payFilter === 'debt'
            ? 'rgba(217,119,6,0.18)'
            : 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(12px) saturate(160%)',
          boxShadow: payFilter === 'debt'
            ? '0 0 0 1.5px rgba(217,119,6,0.45), inset 0 1px 0 rgba(255,255,255,0.4)'
            : '0 1px 3px rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
          color: payFilter === 'debt' ? '#D97706' : '#8A93A0',
          transition: 'all 0.2s',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </button>

        {/* Новая заявка — liquid glass + */}
        <button onClick={onAddOrder} title="Новая заявка" style={{
          width: 34, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(19,102,240,0.12)',
          backdropFilter: 'blur(12px) saturate(160%)',
          boxShadow: '0 1px 3px rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
          color: '#1366F0',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(19,102,240,0.22)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(19,102,240,0.25), inset 0 1px 0 rgba(255,255,255,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(19,102,240,0.12)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.5)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 70px',
          padding: '12px 20px', borderBottom: '1px solid rgba(14,23,38,0.06)',
          background: 'rgba(14,23,38,0.02)',
        }}>
          {['ЗАЯВКА', 'МАРШРУТ', 'КЛИЕНТ', 'МАРЖА', 'ОПЛАТЫ', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>{h}</div>
          ))}
        </div>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        {!loading && filtered.map((order, i) => {
          const margin = (order.client_rate || 0) - (order.carrier_rate || 0)
          const marginPct = order.client_rate > 0 ? Math.round(margin / order.client_rate * 100) : 0
          const route = order.route_from && order.route_to ? `${order.route_from} → ${order.route_to}` : (order.route || '—')
          const [avA, avB] = getGradient(order.client_name || '')
          const overdue = isOverdue(order)
          return (
            <div
              key={order.id}
              style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 1fr 110px 90px 70px',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none',
                alignItems: 'center', cursor: 'pointer', transition: 'background 0.12s',
                background: overdue ? 'rgba(200,25,35,0.05)' : 'transparent',
                borderLeft: overdue ? '3px solid rgba(200,25,35,0.5)' : '3px solid transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = overdue ? 'rgba(200,25,35,0.08)' : 'rgba(14,23,38,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = overdue ? 'rgba(200,25,35,0.05)' : 'transparent'}
              onClick={() => onOpenOrder(order.id)}
            >
              <div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13.5, color: '#1366F0' }}>
                  {order.order_number || order.id}
                </div>
                <div style={{
                  display: 'inline-flex', marginTop: 4, padding: '2px 8px', borderRadius: 6,
                  background: statusBg(order.status), color: statusColor(order.status),
                  fontSize: 11, fontWeight: 600,
                }}>{statusLabel(order.status)}</div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0E1726' }}>{route}</div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 2 }}>
                  {order.load_date || '—'}{order.weight_tons ? ` · ${order.weight_tons} т` : ''}
                </div>
              </div>
              {order.client_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>{initials(order.client_name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {order.client_name}
                  </div>
                </div>
              ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>—</div>}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0E1726' }}>{margin.toLocaleString('ru-RU')} BYN</div>
                <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>{marginPct}%</div>
                <div style={{ fontSize: 10.5, color: '#C4CAD4', marginTop: 2, lineHeight: 1.4 }}>
                  {order.client_rate ? order.client_rate.toLocaleString('ru-RU') : '—'} / {order.carrier_rate ? order.carrier_rate.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: order.client_paid ? 'rgba(30,158,90,0.15)' : 'rgba(14,23,38,0.07)',
                  color: order.client_paid ? '#1E9E5A' : '#A6AEB8',
                }}>К</span>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: order.carrier_paid ? 'rgba(124,58,237,0.15)' : 'rgba(14,23,38,0.07)',
                  color: order.carrier_paid ? '#7C3AED' : '#A6AEB8',
                }}>П</span>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                <button onClick={e => handleDelete(e, order.id)} style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
                <button onClick={e => { e.stopPropagation(); onOpenOrder(order.id) }} style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#A6AEB8', fontSize: 14 }}>Нет заявок</div>
        )}
      </div>
    </div>
  )
}
