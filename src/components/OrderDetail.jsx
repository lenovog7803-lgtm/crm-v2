import { useState, useEffect } from 'react'
import { getOrder, updateOrder as apiUpdate, deleteOrder as apiDelete, createPaymentIn, createPaymentOut } from '../api'
import { fmtMoney, initials, statusLabel, statusColor, statusBg, getGradient } from '../utils'

const STATUSES = ['new', 'in_progress', 'delivered', 'cancelled']
const STATUS_LABELS = { new: 'Новая', in_progress: 'В пути', delivered: 'Доставлено', cancelled: 'Отменено' }

const DOC_FIELDS = [
  { key: 'docs_to_client_sent', label: 'Отправлены клиенту' },
  { key: 'docs_from_client_received', label: 'Получены от клиента' },
  { key: 'docs_to_carrier_sent', label: 'Отправлены перевозчику' },
  { key: 'docs_from_carrier_received', label: 'Получены от перевозчика' },
]

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11.5, color: '#A6AEB8', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

export default function OrderDetail({ orderId, onBack, onDelete, onOpenClient, onOpenCarrier }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(null)

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    getOrder(orderId).then(setOrder).catch(console.error).finally(() => setLoading(false))
  }, [orderId])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>
  if (!order) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Заявка не найдена</div>

  const clientRate = order.client_rate || 0
  const carrierRate = order.carrier_rate || 0
  const margin = clientRate - carrierRate
  const marginPct = clientRate > 0 ? Math.round(margin / clientRate * 100) : 0
  const route = order.route_from && order.route_to ? `${order.route_from} → ${order.route_to}` : '—'

  const patch = async fields => {
    try {
      const updated = await apiUpdate(order.id, fields)
      setOrder(prev => ({ ...prev, ...fields, ...(updated || {}) }))
    } catch (e) { console.error(e) }
  }

  const handleDelete = async () => {
    await apiDelete(order.id).catch(console.error)
    onDelete(order.id)
    onBack()
  }

  const handlePaymentClick = async type => {
    if (payLoading) return
    const field = type === 'client' ? 'client_paid' : 'carrier_paid'
    const dateField = type === 'client' ? 'client_paid_date' : 'carrier_paid_date'
    const now = new Date().toISOString()
    const newVal = !order[field]
    const updated = { [field]: newVal, [dateField]: newVal ? now : null }

    setPayLoading(type)
    try {
      await apiUpdate(order.id, updated)
      setOrder(prev => ({ ...prev, ...updated }))

      if (newVal) {
        if (type === 'client') {
          await createPaymentIn({
            client_id: order.client_id,
            client_name: order.client_name,
            amount: clientRate,
            date: now.slice(0, 10),
            order_id: order.id,
            order_number: order.order_number,
            description: `Оплата по заявке ${order.order_number || order.id}`,
          }).catch(console.error)
        } else {
          await createPaymentOut({
            carrier_id: order.carrier_id,
            carrier_name: order.carrier_name,
            amount: carrierRate,
            date: now.slice(0, 10),
            order_id: order.id,
            order_number: order.order_number,
            description: `Оплата перевозчику по заявке ${order.order_number || order.id}`,
          }).catch(console.error)
        }
      }
    } catch (e) { console.error(e) }
    setPayLoading(null)
  }

  const [avAc, avBc] = getGradient(order.client_name || '')
  const [avAr, avBr] = getGradient(order.carrier_name || '')

  const PayBtn = ({ type, paid, paidDate, rate, accentColor, accentBg }) => (
    <button
      onClick={() => handlePaymentClick(type)}
      disabled={payLoading === type}
      style={{
        flex: 1, padding: '14px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
        background: paid ? `${accentBg}` : 'rgba(14,23,38,0.04)',
        outline: paid ? `2px solid ${accentColor}44` : '2px solid transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, transition: 'all 0.15s',
        opacity: payLoading === type ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
          background: paid ? accentColor : 'transparent',
          border: `1.5px solid ${paid ? accentColor : '#B8C0CC'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
        }}>
          {paid && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 700, letterSpacing: '0.06em' }}>
          {type === 'client' ? 'ОТ КЛИЕНТА' : 'ПЕРЕВОЗЧИКУ'}
        </span>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, fontSize: 20, color: paid ? accentColor : '#0E1726', transition: 'color 0.15s' }}>
        {rate.toLocaleString('ru-RU')} Br
      </div>
      {paid && paidDate ? (
        <div style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>
          Оплачено {new Date(paidDate).toLocaleDateString('ru-RU')}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 500 }}>Ожидается</div>
      )}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Назад
        </button>
        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 15, color: '#1366F0' }}>
          {order.order_number || order.id}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleDelete} style={{
          padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'rgba(200,25,35,0.1)', color: '#C81923',
          fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
          </svg>
          Удалить
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Main info */}
          <div style={{
            background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
            borderRadius: 22, padding: '28px 28px', color: '#fff',
            boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>МАРШРУТ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>{route}</div>
            <div style={{ display: 'flex', gap: 20, marginTop: 18 }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Груз</div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.cargo || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Вес</div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.weight_tons ? order.weight_tons + ' т' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Даты</div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{order.load_date || '—'} — {order.unload_date || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, marginTop: 22, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Ставка клиента</div>
                <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'Onest' }}>{fmtMoney(clientRate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Ставка перевозчика</div>
                <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'Onest' }}>{fmtMoney(carrierRate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Маржа</div>
                <div style={{ fontWeight: 800, fontSize: 20, fontFamily: 'Onest', color: '#5BE89B' }}>
                  {fmtMoney(margin)} <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>({marginPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 12 }}>СТАТУС ЗАЯВКИ</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATUSES.map(s => (
                <button key={s} onClick={() => patch({ status: s })} style={{
                  padding: '8px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  fontFamily: 'Manrope', fontSize: 13, fontWeight: 600,
                  background: order.status === s ? statusBg(s) : 'rgba(14,23,38,0.05)',
                  color: order.status === s ? statusColor(s) : '#8A93A0',
                  outline: order.status === s ? `2px solid ${statusColor(s)}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}>{STATUS_LABELS[s]}</button>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 12 }}>ОПЛАТА</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <PayBtn
                type="client"
                paid={order.client_paid}
                paidDate={order.client_paid_date}
                rate={clientRate}
                accentColor="#1E9E5A"
                accentBg="rgba(30,158,90,0.1)"
              />
              <PayBtn
                type="carrier"
                paid={order.carrier_paid}
                paidDate={order.carrier_paid_date}
                rate={carrierRate}
                accentColor="#7C3AED"
                accentBg="rgba(124,58,237,0.1)"
              />
            </div>
          </div>

          {/* Docs */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 12 }}>ДОКУМЕНТООБОРОТ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {DOC_FIELDS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 12, background: 'rgba(14,23,38,0.03)' }}>
                  <input type="checkbox" checked={!!order[key]} onChange={() => patch({ [key]: !order[key] })}
                    style={{ width: 16, height: 16, accentColor: '#1366F0', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: order[key] ? '#0E1726' : '#8A93A0' }}>{label}</span>
                  {order[key] && (
                    <svg style={{ marginLeft: 'auto', color: '#1E9E5A' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {order.client_name && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 14 }}>КЛИЕНТ</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avAc} 0%, ${avBc} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                }}>{initials(order.client_name)}</div>
                <div>
                  {onOpenClient && order.client_id ? (
                    <button onClick={() => onOpenClient(order.client_id)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontWeight: 700, fontSize: 14, color: '#1366F0', textDecoration: 'underline', textDecorationColor: 'rgba(19,102,240,0.4)',
                      fontFamily: 'Manrope',
                    }}>{order.client_name}</button>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{order.client_name}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {order.carrier_name && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 14 }}>ПЕРЕВОЗЧИК</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avAr} 0%, ${avBr} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="1" />
                    <path d="M16 8h4l3 3v5h-7V8z" />
                    <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
                <div>
                  {onOpenCarrier && order.carrier_id ? (
                    <button onClick={() => onOpenCarrier(order.carrier_id)} style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontWeight: 700, fontSize: 14, color: '#1366F0', textDecoration: 'underline', textDecorationColor: 'rgba(19,102,240,0.4)',
                      fontFamily: 'Manrope',
                    }}>{order.carrier_name}</button>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{order.carrier_name}</div>
                  )}
                  {order.carrier_phone && <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>{order.carrier_phone}</div>}
                </div>
              </div>
              {order.carrier_plate && (
                <div style={{ marginTop: 12 }}>
                  <Row label="Номер ТС" value={order.carrier_plate} />
                </div>
              )}
            </div>
          )}

          {/* Documents links */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 14 }}>ДОКУМЕНТЫ</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Заявка-договор ' + (order.order_number || order.id), color: '#1366F0', bg: 'rgba(19,102,240,0.1)', url: order.doc_url_client },
                { label: 'Акт выполненных работ', color: '#1E9E5A', bg: 'rgba(30,158,90,0.1)', url: order.doc_url_act },
                { label: 'Заявка перевозчику', color: '#D97706', bg: 'rgba(217,119,6,0.1)', url: order.doc_url_carrier },
              ].map(doc => (
                <a key={doc.label} href={doc.url || '#'} target={doc.url ? '_blank' : undefined} rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                    padding: '10px 12px', borderRadius: 12, background: doc.bg,
                    cursor: doc.url ? 'pointer' : 'default', opacity: doc.url ? 1 : 0.5,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: doc.color }}>{doc.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
