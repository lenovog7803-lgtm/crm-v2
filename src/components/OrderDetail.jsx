import { useState, useEffect } from 'react'
import { getOrder, updateOrder as apiUpdate, deleteOrder as apiDelete, createPaymentIn, createPaymentOut, syncOrderDocUrls } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'

const STATUSES = [
  { id: 'new', label: 'Новая', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { id: 'in_progress', label: 'В работе', color: '#1366F0', bg: 'rgba(19,102,240,0.1)' },
  { id: 'done', label: 'Доставлено', color: '#1E9E5A', bg: 'rgba(30,158,90,0.1)' },
  { id: 'cancelled', label: 'Отменено', color: '#8A93A0', bg: 'rgba(138,147,160,0.1)' },
]

const DOC_STEPS = [
  { key: 'docs_to_client_sent', label: 'Отправлено клиенту' },
  { key: 'docs_from_client_received', label: 'Получено от клиента' },
  { key: 'docs_to_carrier_sent', label: 'Отправлено перевозчику' },
  { key: 'docs_from_carrier_received', label: 'Получено от перевозчика' },
]

const sLabel = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 12,
}

const iStyle = {
  width: '100%', height: 36, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.13)', background: 'rgba(255,255,255,0.7)',
  fontFamily: 'Manrope', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

function SLabel({ children }) {
  return <div style={sLabel}>{children}</div>
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>
}

function PaymentButton({ type, order, onClick }) {
  const isPaid = type === 'client' ? order.client_paid : order.carrier_paid
  const date = type === 'client' ? order.client_paid_date : order.carrier_paid_date
  const amount = type === 'client' ? (order.client_rate || 0) : (order.carrier_rate || 0)
  const label = type === 'client' ? 'Клиент оплатил' : 'Перевозчику оплачено'

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
        background: isPaid ? 'rgba(30,158,90,0.08)' : 'rgba(14,23,38,0.04)',
        border: `1px solid ${isPaid ? 'rgba(30,158,90,0.25)' : 'rgba(14,23,38,0.08)'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (!isPaid) e.currentTarget.style.background = 'rgba(14,23,38,0.07)' }}
      onMouseLeave={e => { if (!isPaid) e.currentTarget.style.background = 'rgba(14,23,38,0.04)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 7, flexShrink: 0,
          background: isPaid ? '#1E9E5A' : 'transparent',
          border: `2px solid ${isPaid ? '#1E9E5A' : '#C4CAD4'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {isPaid && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isPaid ? '#1E9E5A' : '#0E1726' }}>{label}</div>
          {isPaid && date ? (
            <div style={{ fontSize: 11, color: '#1E9E5A', marginTop: 2 }}>
              {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>Нажмите чтобы отметить</div>
          )}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 700, color: isPaid ? '#1E9E5A' : '#0E1726', flexShrink: 0 }}>
          {amount.toLocaleString('ru-RU')} Br
        </div>
      </div>
    </div>
  )
}

export default function OrderDetail({ orderId, onBack, onDelete, onOpenClient, onOpenCarrier, onOpenOrder, onDuplicate, onEdit }) {
  const isMobile = useIsMobile()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(null)
  const [docsRefreshing, setDocsRefreshing] = useState(false)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [saveErr, setSaveErr] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    setDraft({})
    getOrder(orderId).then(setOrder).catch(console.error).finally(() => setLoading(false))
  }, [orderId])

  const refreshDocs = () => {
    setDocsRefreshing(true)
    syncOrderDocUrls(orderId)
      .catch(console.error)
      .finally(() => {
        getOrder(orderId).then(setOrder).catch(console.error).finally(() => setDocsRefreshing(false))
      })
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>
  if (!order) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Заявка не найдена</div>

  const view = { ...order, ...draft }
  const isDirty = Object.keys(draft).length > 0

  const clientRate = view.client_rate || 0
  const carrierRate = view.carrier_rate || 0
  const margin = clientRate - carrierRate
  const marginPct = clientRate > 0 ? Math.round(margin / clientRate * 100) : 0
  const route = view.route_from && view.route_to ? `${view.route_from} → ${view.route_to}` : (view.route_from || view.route_to || '—')

  const handleSave = async () => {
    if (!isDirty || saving) return
    setSaving(true)
    setSaveErr(false)
    try {
      await apiUpdate(order.id, draft)
      setOrder(prev => ({ ...prev, ...draft }))
      setDraft({})
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2500)
    } catch (e) {
      console.error(e)
      setSaveErr(true)
      setTimeout(() => setSaveErr(false), 3000)
    }
    setSaving(false)
  }

  const handleStatusChange = (newStatus) => {
    setDraft(d => ({ ...d, status: newStatus }))
  }

  const handleDocToggle = (key) => {
    const dateKey = key + '_date'
    const current = draft[key] !== undefined ? draft[key] : order[key]
    const newVal = !current
    const now = new Date().toISOString()
    setDraft(d => ({ ...d, [key]: newVal, [dateKey]: newVal ? now : null }))
  }

  const handleFieldChange = (field, value) => {
    setDraft(d => ({ ...d, [field]: value }))
  }

  const handlePayment = async type => {
    if (payLoading) return
    const paidField = type === 'client' ? 'client_paid' : 'carrier_paid'
    const dateField = type === 'client' ? 'client_paid_date' : 'carrier_paid_date'
    const rateField = type === 'client' ? 'client_rate' : 'carrier_rate'
    const now = new Date().toISOString()
    const newVal = !order[paidField]
    const updated = { [paidField]: newVal, [dateField]: newVal ? now : null }

    // Optimistic UI update first
    setOrder(prev => ({ ...prev, ...updated }))
    setPayLoading(type)

    apiUpdate(order.id, updated).catch(console.error)

    if (newVal) {
      if (type === 'client') {
        createPaymentIn({
          client_id: order.client_id,
          client_name: order.client_name,
          amount: order[rateField],
          date: now.slice(0, 10),
          order_id: order.id,
          order_number: order.order_number,
          description: `Оплата по заявке ${order.order_number || order.id}`,
        }).catch(console.error)
      } else {
        createPaymentOut({
          carrier_id: order.carrier_id,
          carrier_name: order.carrier_name,
          amount: order[rateField],
          date: now.slice(0, 10),
          order_id: order.id,
          order_number: order.order_number,
          description: `Оплата перевозчику по заявке ${order.order_number || order.id}`,
        }).catch(console.error)
      }
    }
    setPayLoading(null)
  }

  const handleDelete = async () => {
    if (!window.confirm('Удалить заявку?')) return
    await apiDelete(order.id).catch(console.error)
    onDelete(order.id)
    onBack()
  }

  const handleDuplicate = () => {
    if (onDuplicate) onDuplicate(order)
  }

  const [avAc, avBc] = getGradient(order.client_name || '')
  const [avAr, avBr] = getGradient(order.carrier_name || '')
  const curStatus = STATUSES.find(s => s.id === view.status) || STATUSES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'nowrap', overflowX: isMobile ? 'auto' : 'visible' }}>
        <button className="btn-ghost" onClick={onBack} style={{ flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {!isMobile && 'Назад'}
        </button>
        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: isMobile ? 13 : 15, color: '#1366F0', flexShrink: 0 }}>
          {order.order_number || `#${order.id}`}
        </span>
        {!isMobile && order.created_at && (
          <span style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 500 }}>
            создана {new Date(order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
        <span style={{
          padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: curStatus.bg, color: curStatus.color,
        }}>{curStatus.label}</span>
        {isDirty && !isMobile && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#D97706', padding: '3px 10px', borderRadius: 8, background: 'rgba(217,119,6,0.1)' }}>
            Есть изменения
          </span>
        )}
        <div style={{ flex: 1 }} />
        {saveErr && <span style={{ fontSize: 12, color: '#C81923', fontWeight: 600, flexShrink: 0 }}>Ошибка</span>}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          title="Сохранить"
          style={{
            padding: isMobile ? '8px' : '11px 26px', borderRadius: 12, cursor: isDirty ? 'pointer' : 'default',
            border: `1px solid ${savedOk ? 'rgba(30,158,90,0.35)' : isDirty ? 'rgba(19,102,240,0.35)' : 'rgba(255,255,255,0.2)'}`,
            background: savedOk ? 'rgba(30,158,90,0.15)' : isDirty ? 'rgba(19,102,240,0.15)' : 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            color: savedOk ? '#1E9E5A' : isDirty ? '#1366F0' : '#A6AEB8',
            fontFamily: 'Manrope', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            transition: 'all 0.25s',
          }}
        >
          {savedOk
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          }
          {!isMobile && (saving ? 'Сохранение...' : savedOk ? 'Сохранено' : 'Сохранить')}
        </button>

        {onEdit && (
          <button onClick={() => onEdit(order)} title="Редактировать" style={{
            padding: isMobile ? '8px' : '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: 'rgba(19,102,240,0.08)', color: '#1366F0',
            fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {!isMobile && 'Редактировать'}
          </button>
        )}
        <button onClick={handleDuplicate} disabled={duplicating} title="Дублировать" style={{
          padding: isMobile ? '8px' : '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: 'rgba(14,23,38,0.06)', color: '#5A6573',
          fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          {!isMobile && (duplicating ? '...' : 'Дублировать')}
        </button>
        <button onClick={handleDelete} title="Удалить" style={{
          padding: isMobile ? '8px' : '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
          background: 'rgba(200,25,35,0.1)', color: '#C81923',
          fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
          </svg>
          {!isMobile && 'Удалить'}
        </button>
      </div>

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hero dark card */}
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
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.cargo || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Вес</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.weight_tons ? view.weight_tons + ' т' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Загрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.load_date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Выгрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.unload_date || '—'}</div>
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
                  {fmtMoney(margin)} <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>({marginPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>СТАТУС ЗАЯВКИ</SLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STATUSES.map(s => (
                <div
                  key={s.id}
                  onClick={() => handleStatusChange(s.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 20, cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: view.status === s.id ? s.bg : 'rgba(14,23,38,0.04)',
                    color: view.status === s.id ? s.color : '#8A93A0',
                    border: `1.5px solid ${view.status === s.id ? s.color + '50' : 'rgba(14,23,38,0.08)'}`,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { if (view.status !== s.id) { e.currentTarget.style.background = s.bg; e.currentTarget.style.color = s.color } }}
                  onMouseLeave={e => { if (view.status !== s.id) { e.currentTarget.style.background = 'rgba(14,23,38,0.04)'; e.currentTarget.style.color = '#8A93A0' } }}
                >
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Payments */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ОПЛАТА</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PaymentButton type="client" order={order} onClick={() => !payLoading && handlePayment('client')} />
              <PaymentButton type="carrier" order={order} onClick={() => !payLoading && handlePayment('carrier')} />
            </div>
          </div>

          {/* Docs */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ДОКУМЕНТООБОРОТ</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DOC_STEPS.map(step => {
                const isDone = !!view[step.key]
                const date = view[step.key + '_date']
                return (
                  <div
                    key={step.key}
                    onClick={() => handleDocToggle(step.key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                      background: isDone ? 'rgba(30,158,90,0.06)' : 'rgba(14,23,38,0.03)',
                      border: `1px solid ${isDone ? 'rgba(30,158,90,0.2)' : 'rgba(14,23,38,0.07)'}`,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { if (!isDone) e.currentTarget.style.background = 'rgba(14,23,38,0.06)' }}
                    onMouseLeave={e => { if (!isDone) e.currentTarget.style.background = 'rgba(14,23,38,0.03)' }}
                  >
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: isDone ? '#1E9E5A' : 'transparent',
                      border: `2px solid ${isDone ? '#1E9E5A' : '#C4CAD4'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}>
                      {isDone && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isDone ? '#1E9E5A' : '#0E1726' }}>{step.label}</div>
                      {isDone && date && (
                        <div style={{ fontSize: 11, color: '#1E9E5A', marginTop: 2 }}>
                          {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в{' '}
                          {new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? '#1E9E5A' : '#A6AEB8', flexShrink: 0 }}>
                      {isDone ? 'готово' : 'ожидание'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Client */}
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
                      fontWeight: 700, fontSize: 14, color: '#1366F0',
                      textDecoration: 'underline', textDecorationColor: 'rgba(19,102,240,0.4)',
                      fontFamily: 'Manrope',
                    }}>{order.client_name}</button>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{order.client_name}</div>
                  )}
                  {order.client_phone && <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>{order.client_phone}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Carrier */}
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
                      fontWeight: 700, fontSize: 14, color: '#1366F0',
                      textDecoration: 'underline', textDecorationColor: 'rgba(19,102,240,0.4)',
                      fontFamily: 'Manrope',
                    }}>{order.carrier_name}</button>
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{order.carrier_name}</div>
                  )}
                  {order.carrier_phone && <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>{order.carrier_phone}</div>}
                </div>
              </div>
              {(order.vehicle_plate || order.vehicle_type || order.driver_name || order.driver_phone) && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(order.vehicle_plate || order.vehicle_type) && (
                    <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(14,23,38,0.04)', fontSize: 12, color: '#5A6573', fontFamily: 'JetBrains Mono' }}>
                      {[order.vehicle_plate, order.vehicle_type].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {(order.driver_name || order.driver_phone) && (
                    <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(14,23,38,0.04)', fontSize: 12, color: '#5A6573' }}>
                      {[order.driver_name, order.driver_phone].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {!order.vehicle_plate && !order.driver_name && order.vehicle_info && (
                    <div style={{ padding: '7px 12px', borderRadius: 10, background: 'rgba(14,23,38,0.04)', fontSize: 12, color: '#5A6573', fontFamily: 'JetBrains Mono' }}>
                      {order.vehicle_info}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Documents */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', flex: 1 }}>ДОКУМЕНТЫ</div>
              <button
                onClick={refreshDocs}
                title="Обновить ссылки на документы"
                style={{
                  width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'rgba(19,102,240,0.08)', color: '#1366F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(19,102,240,0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(19,102,240,0.08)'}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: docsRefreshing ? 'spin 0.8s linear infinite' : 'none' }}
                >
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: `Заявка-договор ${order.order_number || ''}`, color: '#1366F0', bg: 'rgba(19,102,240,0.1)', url: order.doc_url_client },
                { label: 'Акт выполненных работ', color: '#1E9E5A', bg: 'rgba(30,158,90,0.1)', url: order.doc_url_act },
                { label: 'Заявка перевозчику', color: '#D97706', bg: 'rgba(217,119,6,0.1)', url: order.doc_url_carrier },
              ].map(doc => (
                <a key={doc.label} href={doc.url || '#'} target={doc.url ? '_blank' : undefined} rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                    padding: '10px 12px', borderRadius: 12, background: doc.bg,
                    cursor: doc.url ? 'pointer' : 'default', opacity: doc.url ? 1 : 0.4,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600, color: doc.color }}>{doc.label}</span>
                  {doc.url && (
                    <svg style={{ marginLeft: 'auto' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Cargo info */}
          {(order.cargo || order.weight_tons || order.payment_days) && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 14 }}>ГРУЗ И УСЛОВИЯ</div>
              {order.cargo && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Груз</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726' }}>{order.cargo}</span>
                </div>
              )}
              {order.weight_tons && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Вес</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', fontFamily: 'JetBrains Mono' }}>{order.weight_tons} т</span>
                </div>
              )}
              {order.payment_days && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Срок оплаты</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', fontFamily: 'JetBrains Mono' }}>{order.payment_days} дн.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
