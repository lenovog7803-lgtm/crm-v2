import { useState, useEffect, useRef } from 'react'
import { getOrder, updateOrder as apiUpdate, deleteOrder as apiDelete, restoreTrash, markPayment, syncOrderDocUrls, generateClientDoc, generateCarrierDoc, generateAct, getClient, getClients, getCarrier, getCarriers, getOrderHistory } from '../api'
import { fmtMoney, initials, getGradient } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'
import { useRealtime } from '../hooks/useRealtime'
import { useToast } from './Toast'
import { useCelebration } from './Celebration'
import OrderPaymentModal from './OrderPaymentModal'

const STATUSES = [
  { id: 'new', label: 'Новая', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { id: 'in_progress', label: 'В работе', color: '#1366F0', bg: 'rgba(19,102,240,0.1)' },
  { id: 'done', label: 'Доставлено', color: '#1E9E5A', bg: 'rgba(30,158,90,0.1)' },
  { id: 'cancelled', label: 'Отменено', color: '#8A93A0', bg: 'rgba(138,147,160,0.1)' },
]

const DOC_STEPS = [
  { key: 'docs_to_client_sent',       dateKey: 'docs_to_client_date',      label: 'Отправлено клиенту' },
  { key: 'docs_from_client_received', dateKey: 'docs_from_client_date',    label: 'Получено от клиента' },
  { key: 'docs_to_carrier_sent',      dateKey: 'docs_to_carrier_date',     label: 'Отправлено перевозчику' },
  { key: 'docs_from_carrier_received',dateKey: 'docs_from_carrier_date',   label: 'Получено от перевозчика' },
]

const HISTORY_FIELD_LABEL = {
  client_rate: 'Ставка клиента',
  carrier_rate: 'Ставка перевозчика',
  status: 'Статус заявки',
  client_paid: 'Оплата клиента',
  carrier_paid: 'Оплата перевозчику',
  route_from: 'Город отправления',
  route_to: 'Город назначения',
  route_from_address: 'Адрес загрузки',
  route_to_address: 'Адрес выгрузки',
  load_date: 'Дата загрузки',
  unload_date: 'Дата выгрузки',
  cargo: 'Груз',
  weight_tons: 'Вес',
  notes: 'Заметки',
  driver_name: 'Водитель',
  driver_phone: 'Телефон водителя',
  vehicle_plate: 'Номер ТС',
  vehicle_type: 'Тип ТС',
}

function OrderHistorySection({ orderId }) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  const toggle = async () => {
    if (!open && !loaded) {
      const logs = await getOrderHistory(orderId).catch(() => [])
      setHistory(Array.isArray(logs) ? logs : [])
      setLoaded(true)
    }
    setOpen(!open)
  }

  return (
    <div className="card" style={{ padding: '20px 20px' }}>
      <div
        onClick={toggle}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>
          ИСТОРИЯ ИЗМЕНЕНИЙ
        </span>
        <span style={{ fontSize: 12, color: '#8A93A0' }}>{open ? 'свернуть ▲' : 'показать ▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {history.length === 0 ? (
            <div style={{ fontSize: 12, color: '#A6AEB8', textAlign: 'center', padding: 16 }}>Изменений пока не было</div>
          ) : (
            history.map((h, i) => (
              <div key={h.id || i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < history.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none' }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: '#1366F0', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: '#0E1726' }}>
                    <b>{HISTORY_FIELD_LABEL[h.field] || h.field}</b>: {h.old_value || '—'} → {h.new_value || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>
                    {h.user} · {new Date(h.timestamp).toLocaleDateString('ru-RU')} в {new Date(h.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

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

function ClickableName({ name, onClick }) {
  const [pressed, setPressed] = useState(false)
  const handleClick = () => {
    setPressed(true)
    setTimeout(onClick, 90)
  }
  return (
    <span
      onClick={handleClick}
      style={{
        cursor: 'pointer', display: 'inline-block', padding: '2px 6px', margin: '-2px -6px',
        borderRadius: 8, background: pressed ? 'rgba(19,102,240,0.12)' : 'transparent',
        transition: 'background 0.12s ease',
        fontWeight: 700, fontSize: 14, color: '#1366F0',
        textDecoration: 'underline', textDecorationColor: 'rgba(19,102,240,0.4)',
        fontFamily: 'Manrope',
      }}
    >{name}</span>
  )
}

function PaymentButton({ type, order, onClick }) {
  const isCarrier = type === 'carrier'
  const isPaid = isCarrier ? order.carrier_paid : order.client_paid
  const date = isCarrier ? order.carrier_paid_date : order.client_paid_date
  const ppNumber = isCarrier ? order.carrier_pp_number : order.client_pp_number
  const amount = isCarrier ? (order.carrier_rate || 0) : (order.client_rate || 0)
  const label = isCarrier ? 'Платим перевозчику' : 'Получаем от клиента'
  const accent = isPaid ? '#1E9E5A' : (isCarrier ? '#E0473B' : '#0E1726')

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1, padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
        background: isPaid ? 'rgba(30,158,90,0.08)' : (isCarrier ? 'rgba(224,71,59,0.05)' : 'rgba(14,23,38,0.04)'),
        border: isCarrier
          ? `2px solid ${isPaid ? 'rgba(30,158,90,0.28)' : 'rgba(224,71,59,0.35)'}`
          : `1px solid ${isPaid ? 'rgba(30,158,90,0.25)' : 'rgba(14,23,38,0.08)'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (!isPaid) e.currentTarget.style.background = isCarrier ? 'rgba(224,71,59,0.09)' : 'rgba(14,23,38,0.07)' }}
      onMouseLeave={e => { if (!isPaid) e.currentTarget.style.background = isCarrier ? 'rgba(224,71,59,0.05)' : 'rgba(14,23,38,0.04)' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: accent }}>{isCarrier ? '↑' : '↓'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: isPaid ? '#1E9E5A' : accent }}>{label}</span>
          </div>
          {isPaid && date ? (
            <div style={{ fontSize: 11, color: '#1E9E5A', marginTop: 2 }}>
              {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              {ppNumber && ` · ПП №${ppNumber}`}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>
              {isCarrier ? 'Сумма к перечислению — нажмите чтобы отметить' : 'Нажмите чтобы отметить'}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: isCarrier ? 18 : 16, fontWeight: 700, color: isPaid ? '#1E9E5A' : accent, flexShrink: 0 }}>
          {isCarrier ? '' : '+'}{amount.toLocaleString('ru-RU')} Br
        </div>
      </div>
    </div>
  )
}

export default function OrderDetail({ orderId, onBack, onDelete, onOpenClient, onOpenCarrier, onOpenOrder, onDuplicate, onEdit }) {
  const isMobile = useIsMobile()
  const { show } = useToast()
  const { celebrate } = useCelebration()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(null)
  const [paymentModal, setPaymentModal] = useState(null) // 'client' | 'carrier' | null
  const [docsRefreshing, setDocsRefreshing] = useState(false)
  const [docLoading, setDocLoading] = useState({})
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

  // Marked right before every local mutation so the realtime listener can
  // tell "I just changed this" apart from "someone else changed this" — the
  // broadcast reaches every connected client, including the one that made
  // the edit, and it shouldn't tell you your own save was "another user".
  const lastLocalEditRef = useRef(0)

  useRealtime((event) => {
    if (event.type === 'order_updated' && event.order_id === orderId) {
      const isSelf = Date.now() - lastLocalEditRef.current < 2000
      getOrder(orderId).then(setOrder).catch(console.error)
      if (!isSelf) show('Заявка обновлена другим пользователем', { type: 'info' })
    }
  })

  const refreshDocs = () => {
    setDocsRefreshing(true)
    syncOrderDocUrls(orderId)
      .catch(console.error)
      .finally(() => {
        getOrder(orderId).then(setOrder).catch(console.error).finally(() => setDocsRefreshing(false))
      })
  }

  const handleGenerate = async (type) => {
    console.log('[DOC] Generating type:', type, 'for order:', orderId)
    setDocLoading(prev => ({ ...prev, [type]: true }))
    try {
      const fn = type === 'client' ? generateClientDoc : type === 'carrier' ? generateCarrierDoc : generateAct
      const result = await fn(orderId)
      console.log('[DOC] Result:', result)
      const url = result?.url || result?.doc_url || result?.link
      if (url) {
        const field = type === 'client' ? 'doc_url_client' : type === 'carrier' ? 'doc_url_carrier' : 'doc_url_act'
        setOrder(prev => ({ ...prev, [field]: url }))
        window.open(url, '_blank')
        const docLabel = type === 'client' ? 'Заявка-договор' : type === 'carrier' ? 'Заявка перевозчику' : 'Акт'
        show(`${docLabel}: документ сформирован`, { type: 'success' })
      } else {
        console.error('[DOC] No URL in result:', result)
        show('Документ создан, но URL не получен', { type: 'error' })
      }
    } catch (e) {
      console.error('[DOC] Error:', e)
      show('Ошибка генерации: ' + (e.message || e), { type: 'error' })
    }
    setDocLoading(prev => ({ ...prev, [type]: false }))
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
    const becameDelivered = draft.status === 'done' && order.status !== 'done'
    try {
      lastLocalEditRef.current = Date.now()
      await apiUpdate(order.id, draft)
      setOrder(prev => ({ ...prev, ...draft }))
      setDraft({})
      setSavedOk(true)
      if (becameDelivered) celebrate()
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

  const handleDocToggle = async (key) => {
    // Saved immediately (not staged into draft) — this is a checklist tick,
    // not a form field, and losing the timestamp because someone navigated
    // away before hitting the main Save button defeats the point of it.
    const step = DOC_STEPS.find(s => s.key === key)
    const dateKey = step?.dateKey || key + '_date'
    const current = draft[key] !== undefined ? draft[key] : order[key]
    const newVal = !current
    const now = new Date().toISOString()
    const patch = { [key]: newVal, [dateKey]: newVal ? now : null }
    try {
      lastLocalEditRef.current = Date.now()
      await apiUpdate(order.id, patch)
      setOrder(prev => ({ ...prev, ...patch }))
      show(`${step?.label || key}${newVal ? ' — отмечено' : ' — снято'}`, { type: 'success' })
    } catch (e) {
      show('Ошибка сохранения: ' + e.message, { type: 'error' })
    }
  }

  const handleFieldChange = (field, value) => {
    setDraft(d => ({ ...d, [field]: value }))
  }

  const handlePayment = async (side) => {
    const isPaid = side === 'client' ? order.client_paid : order.carrier_paid
    if (!isPaid) {
      setPaymentModal(side) // открыть модалку ввода ПП
      return
    }
    // снятие отметки — без модалки, простое действие + тост с отменой
    const paidField = side === 'client' ? 'client_paid' : 'carrier_paid'
    const prevPPNumber = side === 'client' ? order.client_pp_number : order.carrier_pp_number
    const prevPPDate = side === 'client' ? order.client_pp_date : order.carrier_pp_date
    try {
      lastLocalEditRef.current = Date.now()
      await markPayment(order.id, side, { paid: false })
      setOrder(prev => ({ ...prev, [paidField]: false }))
      show('Отметка оплаты снята', {
        type: 'info',
        actionLabel: 'Отменить',
        onAction: async () => {
          lastLocalEditRef.current = Date.now()
          await markPayment(order.id, side, { paid: true, pp_number: prevPPNumber || null, pp_date: prevPPDate || null })
          getOrder(order.id).then(setOrder).catch(console.error)
        },
      })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const handleDelete = async () => {
    const deletedId = order.id
    try {
      await apiDelete(deletedId)
      onDelete(deletedId)
      onBack()
      show('Заявка удалена', {
        type: 'info',
        actionLabel: 'Отменить',
        onAction: async () => {
          await restoreTrash('orders', deletedId)
          onOpenOrder?.(deletedId)
        },
      })
    } catch (e) {
      show('Ошибка удаления: ' + e.message, { type: 'error' })
    }
  }

  const handleDuplicate = () => {
    if (onDuplicate) onDuplicate(order)
  }

  const openClientDetail = async () => {
    if (!onOpenClient) return
    if (!order.client_id && !order.client_name) {
      show('Клиент не указан в заявке', { type: 'error' })
      return
    }
    if (order.client_id) {
      try {
        const c = await getClient(order.client_id) // проверяем что реально существует
        onOpenClient(c.id)
        return
      } catch (e) {
        // id не сработал — ищем по имени как запасной вариант
      }
    }
    if (order.client_name) {
      try {
        const res = await getClients(order.client_name)
        const list = Array.isArray(res) ? res : (res.clients || [])
        const found = list.find(c => (c.name || '').toLowerCase().trim() === order.client_name.toLowerCase().trim())
        if (found) { onOpenClient(found.id); return }
      } catch (e) {}
    }
    show(`Карточка клиента «${order.client_name || order.client_id}» не найдена в базе`, { type: 'error' })
  }

  const openCarrierDetail = async () => {
    if (!onOpenCarrier) return
    if (!order.carrier_id && !order.carrier_name) {
      show('Перевозчик не указан в заявке', { type: 'error' })
      return
    }
    if (order.carrier_id) {
      try {
        const c = await getCarrier(order.carrier_id) // проверяем что реально существует
        onOpenCarrier(c.id)
        return
      } catch (e) {
        // id не сработал — ищем по имени как запасной вариант
      }
    }
    if (order.carrier_name) {
      try {
        const res = await getCarriers(order.carrier_name)
        const list = Array.isArray(res) ? res : (res.carriers || [])
        const found = list.find(c =>
          (c.company_name || c.name || '').toLowerCase().trim() === order.carrier_name.toLowerCase().trim()
        )
        if (found) { onOpenCarrier(found.id); return }
      } catch (e) {}
    }
    show(`Карточка перевозчика «${order.carrier_name || order.carrier_id}» не найдена в базе`, { type: 'error' })
  }

  const [avAc, avBc] = getGradient(order.client_name || '')
  const [avAr, avBr] = getGradient(order.carrier_name || '')
  const curStatus = STATUSES.find(s => s.id === view.status) || STATUSES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top bar */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Row 1: back + order info + save */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onBack} style={{
              width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(14,23,38,0.12)',
              background: 'rgba(255,255,255,0.7)', color: '#0E1726', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 14, color: '#1366F0' }}>
              {order.order_number || `#${order.id}`}
            </span>
            <span style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: curStatus.bg, color: curStatus.color,
            }}>{curStatus.label}</span>
            <div style={{ flex: 1 }} />
            {saveErr && <span style={{ fontSize: 11, color: '#C81923', fontWeight: 700 }}>Ошибка</span>}
            <button onClick={handleSave} disabled={!isDirty || saving} style={{
              minWidth: 36, height: 36, borderRadius: 11, cursor: isDirty ? 'pointer' : 'default',
              border: `1px solid ${savedOk ? 'rgba(30,158,90,0.4)' : isDirty ? 'rgba(19,102,240,0.4)' : 'rgba(14,23,38,0.1)'}`,
              background: savedOk ? 'rgba(30,158,90,0.12)' : isDirty ? 'rgba(19,102,240,0.12)' : 'rgba(255,255,255,0.5)',
              color: savedOk ? '#1E9E5A' : isDirty ? '#1366F0' : '#C4CAD4',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontFamily: 'Manrope', fontWeight: 700, fontSize: 13, flexShrink: 0,
              padding: isDirty ? '0 14px' : '0 10px',
              transition: 'all 0.2s',
            }}>
              {savedOk
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              }
              {isDirty && <span>{saving ? 'Сохр...' : savedOk ? 'OK' : 'Сохранить'}</span>}
            </button>
          </div>
          {/* Row 2: secondary actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isDirty && <span style={{ fontSize: 11.5, color: '#D97706', fontWeight: 600 }}>Есть изменения</span>}
            <div style={{ flex: 1 }} />
            {onEdit && (
              <button onClick={() => onEdit(order)} style={{
                height: 34, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'rgba(19,102,240,0.08)', color: '#1366F0',
                fontFamily: 'Manrope', fontWeight: 600, fontSize: 12.5,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Ред.
              </button>
            )}
            <button onClick={handleDuplicate} disabled={duplicating} style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(14,23,38,0.06)', color: '#5A6573',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button onClick={handleDelete} style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(200,25,35,0.08)', color: '#C81923',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-ghost" onClick={onBack} style={{ flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Назад
          </button>
          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 15, color: '#1366F0', flexShrink: 0 }}>
            {order.order_number || `#${order.id}`}
          </span>
          {order.created_at && (
            <span style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 500 }}>
              создана {new Date(order.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          )}
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0, background: curStatus.bg, color: curStatus.color }}>{curStatus.label}</span>
          {isDirty && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#D97706', padding: '3px 10px', borderRadius: 8, background: 'rgba(217,119,6,0.1)' }}>Есть изменения</span>}
          <div style={{ flex: 1 }} />
          {saveErr && <span style={{ fontSize: 12, color: '#C81923', fontWeight: 600, flexShrink: 0 }}>Ошибка</span>}
          <button onClick={handleSave} disabled={!isDirty || saving} style={{
            padding: '11px 26px', borderRadius: 12, cursor: isDirty ? 'pointer' : 'default',
            border: `1px solid ${savedOk ? 'rgba(30,158,90,0.35)' : isDirty ? 'rgba(19,102,240,0.35)' : 'rgba(255,255,255,0.2)'}`,
            background: savedOk ? 'rgba(30,158,90,0.15)' : isDirty ? 'rgba(19,102,240,0.15)' : 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            color: savedOk ? '#1E9E5A' : isDirty ? '#1366F0' : '#A6AEB8',
            fontFamily: 'Manrope', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, transition: 'all 0.25s',
          }}>
            {savedOk
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            }
            {saving ? 'Сохранение...' : savedOk ? 'Сохранено' : 'Сохранить'}
          </button>
          {onEdit && (
            <button onClick={() => onEdit(order)} style={{ padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'rgba(19,102,240,0.08)', color: '#1366F0', fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Редактировать
            </button>
          )}
          <button onClick={handleDuplicate} disabled={duplicating} style={{ padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'rgba(14,23,38,0.06)', color: '#5A6573', fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            {duplicating ? '...' : 'Дублировать'}
          </button>
          <button onClick={handleDelete} style={{ padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'rgba(200,25,35,0.1)', color: '#C81923', fontFamily: 'Manrope', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /></svg>
            Удалить
          </button>
        </div>
      )}

      <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Hero dark card */}
          <div style={{
            background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)',
            borderRadius: 22, padding: isMobile ? '18px 18px' : '28px 28px', color: '#fff',
            boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>МАРШРУТ</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: isMobile ? 17 : 22, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{route}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? 10 : 20, marginTop: isMobile ? 12 : 18 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Груз</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.cargo || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Вес</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.weight_tons ? view.weight_tons + ' т' : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Загрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.load_date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Выгрузка</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{view.unload_date || '—'}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)', gap: isMobile ? 8 : 24, marginTop: isMobile ? 14 : 22, paddingTop: isMobile ? 14 : 18, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Клиент</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 20, fontFamily: 'Onest' }}>{fmtMoney(clientRate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Перевозчик</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 20, fontFamily: 'Onest' }}>{fmtMoney(carrierRate)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>Маржа</div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 20, fontFamily: 'Onest', color: '#5BE89B' }}>
                  {fmtMoney(margin)}{!isMobile && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}> ({marginPct}%)</span>}
                </div>
                {isMobile && <div style={{ fontSize: 10, color: 'rgba(91,232,155,0.7)', marginTop: 1 }}>{marginPct}%</div>}
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
              <PaymentButton type="client" order={view} onClick={() => handlePayment('client')} />
              <PaymentButton type="carrier" order={view} onClick={() => handlePayment('carrier')} />
            </div>
          </div>

          {/* Docs */}
          <div className="card" style={{ padding: '20px 20px' }}>
            <SLabel>ДОКУМЕНТООБОРОТ</SLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DOC_STEPS.map(step => {
                const isDone = !!view[step.key]
                const date = view[step.dateKey]
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
                  {onOpenClient && (order.client_id || order.client_name) ? (
                    <ClickableName name={order.client_name} onClick={openClientDetail} />
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
                  {onOpenCarrier && (order.carrier_id || order.carrier_name) ? (
                    <ClickableName name={order.carrier_name} onClick={openCarrierDetail} />
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
                { type: 'client',  label: `Заявка-договор ${order.order_number || ''}`, color: '#1366F0', bg: 'rgba(19,102,240,0.1)', url: order.doc_url_client },
                { type: 'act',     label: 'Акт выполненных работ',  color: '#1E9E5A', bg: 'rgba(30,158,90,0.1)',  url: order.doc_url_act },
                { type: 'carrier', label: 'Заявка перевозчику',     color: '#D97706', bg: 'rgba(217,119,6,0.1)', url: order.doc_url_carrier },
              ].map(doc => (
                <div key={doc.type} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <a href={doc.url || '#'} target={doc.url ? '_blank' : undefined} rel="noopener noreferrer"
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
                      padding: '10px 12px', borderRadius: 12, background: doc.bg,
                      cursor: doc.url ? 'pointer' : 'default', opacity: doc.url ? 1 : 0.5,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: doc.color, flex: 1 }}>{doc.label}</span>
                    {doc.url && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={doc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </a>
                  <button
                    onClick={() => handleGenerate(doc.type)}
                    disabled={!!docLoading[doc.type]}
                    title={doc.url ? 'Перегенерировать' : 'Создать документ'}
                    style={{
                      flexShrink: 0, height: 38, padding: '0 12px', borderRadius: 11, border: 'none',
                      cursor: docLoading[doc.type] ? 'wait' : 'pointer',
                      background: doc.bg, color: doc.color,
                      fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {docLoading[doc.type] ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    )}
                    {doc.url ? 'Пересоздать' : 'Создать'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Cargo info */}
          {Boolean(order.cargo || order.weight_tons || order.payment_days) && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8', marginBottom: 14 }}>ГРУЗ И УСЛОВИЯ</div>
              {Boolean(order.cargo) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Груз</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726' }}>{order.cargo}</span>
                </div>
              )}
              {Boolean(order.weight_tons) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Вес</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', fontFamily: 'JetBrains Mono' }}>{order.weight_tons} т</span>
                </div>
              )}
              {Boolean(order.payment_days) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>Срок оплаты</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', fontFamily: 'JetBrains Mono' }}>{order.payment_days} дн.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <OrderHistorySection orderId={order.id} />

      {paymentModal && (
        <OrderPaymentModal
          order={order}
          side={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSaved={() => { lastLocalEditRef.current = Date.now(); getOrder(order.id).then(setOrder).catch(console.error); setPaymentModal(null) }}
        />
      )}
    </div>
  )
}
