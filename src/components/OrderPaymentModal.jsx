import { useState } from 'react'
import { addPayment, deletePayment, getOrder } from '../api'
import { useToast } from './Toast'
import { useEscapeKey } from '../hooks/useEscapeKey'

const today = () => new Date().toISOString().slice(0, 10)

export default function OrderPaymentModal({ order, side, onClose, onSaved, onBeforeSave }) {
  const { show } = useToast()
  useEscapeKey(onClose)

  const isCarrier = side === 'carrier'
  const expected = (isCarrier ? order.carrier_rate : order.client_rate) || 0
  const who = isCarrier ? order.carrier_name : order.client_name

  // Payments already saved on the order from an earlier partial-payment
  // session — shown read-only (can only be removed, not amount-edited: the
  // backend only exposes add/delete, no in-place edit). A reopened modal
  // must not re-default a new row to the full rate on top of these, or
  // saving would double-count what's already paid.
  const savedField = isCarrier ? 'carrier_payments' : 'client_payments'
  const [existingPayments, setExistingPayments] = useState(
    (order[savedField] || []).filter(p => !String(p.id).startsWith('legacy-'))
  )
  const existingTotal = existingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = expected - existingTotal

  const [payments, setPayments] = useState([
    { id: 'new-0', pp_number: '', pp_date: today(), amount: remaining > 0 ? remaining : 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [removingId, setRemovingId] = useState(null)

  const totalEntered = existingTotal + payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const matches = Math.abs(totalEntered - expected) < 0.01

  const removeExisting = async (paymentId) => {
    setRemovingId(paymentId)
    try {
      onBeforeSave?.()
      await deletePayment(order.id, side, paymentId)
      setExistingPayments(prev => prev.filter(p => p.id !== paymentId))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setRemovingId(null)
  }

  const addRow = () => {
    const remaining = expected - totalEntered
    setPayments(prev => [...prev, {
      id: `new-${prev.length}`,
      pp_number: '',
      pp_date: today(),
      amount: remaining > 0 ? remaining : 0,
    }])
  }

  const updateRow = (id, field, value) => {
    setPayments(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const removeRow = (id) => {
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    const createdIds = []
    try {
      onBeforeSave?.()
      const rowsToSave = payments.filter(p => (p.pp_number || '').trim() || (Number(p.amount) || 0) > 0)
      for (const p of rowsToSave) {
        const amount = Number(p.amount) || 0
        const res = await addPayment(order.id, side, {
          pp_number: (p.pp_number || '').trim(),
          pp_date: p.pp_date || today(),
          amount,
        })
        const created = res.payments?.[res.payments.length - 1]
        if (created?.id) createdIds.push(created.id)
      }
      show(
        isCarrier
          ? `Отмечено: перевозчику ${who} — ${totalEntered.toLocaleString('ru-RU')} Br`
          : `Отмечено: от клиента ${who} — ${totalEntered.toLocaleString('ru-RU')} Br`,
        {
          type: matches ? 'success' : 'info',
          actionLabel: createdIds.length ? 'Отменить' : undefined,
          onAction: createdIds.length
            ? async () => {
                onBeforeSave?.()
                for (const id of createdIds) {
                  await deletePayment(order.id, side, id).catch(() => {})
                }
                onSaved?.()
              }
            : undefined,
        }
      )
      onSaved?.()
      onClose()
    } catch (e) {
      // "Failed to fetch" can mean the response never made it back even
      // though the write landed — check the order before reporting a
      // failure that the data already contradicts.
      const paidField = isCarrier ? 'carrier_paid' : 'client_paid'
      const fresh = await getOrder(order.id).catch(() => null)
      if (fresh?.[paidField]) {
        onSaved?.()
        onClose()
        setSaving(false)
        return
      }
      setError('Ошибка: ' + e.message)
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)',
      zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 460,
        padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: isCarrier ? '#E0473B' : '#1E9E5A', marginBottom: 6,
        }}>
          {isCarrier ? 'Платим перевозчику' : 'Получаем от клиента'}
        </div>
        <div style={{ fontSize: 14, color: '#5A6573', marginBottom: 4 }}>{who}</div>
        <div style={{
          fontFamily: 'JetBrains Mono', fontSize: 28, fontWeight: 700,
          color: isCarrier ? '#E0473B' : '#1E9E5A', marginBottom: 22,
        }}>
          {expected.toLocaleString('ru-RU')} Br
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Платёжные поручения
            </div>
            <button
              onClick={addRow}
              style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid #1366F0', background: 'transparent', color: '#1366F0', fontSize: 14, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}
              title="Добавить ещё один ПП"
              type="button"
            >
              +
            </button>
          </div>

          {existingPayments.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', opacity: removingId === p.id ? 0.5 : 1 }}>
              <div style={{ width: 90, padding: '9px 10px', borderRadius: 10, background: '#F0F2F5', fontSize: 12, color: '#5A6573', boxSizing: 'border-box' }}>
                {p.pp_number || '—'}
              </div>
              <div style={{ width: 130, padding: '9px 10px', borderRadius: 10, background: '#F0F2F5', fontSize: 12, color: '#5A6573', boxSizing: 'border-box' }}>
                {p.pp_date}
              </div>
              <div style={{ flex: 1, padding: '9px 10px', borderRadius: 10, background: '#F0F2F5', fontSize: 12, color: '#5A6573', boxSizing: 'border-box', minWidth: 0 }}>
                {(Number(p.amount) || 0).toLocaleString('ru-RU')} Br · сохранено
              </div>
              <button
                onClick={() => removeExisting(p.id)}
                disabled={removingId === p.id}
                title="Удалить сохранённый платёж"
                type="button"
                style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: '#E0473B', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}

          {payments.map(p => (
            <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                value={p.pp_number}
                onChange={e => updateRow(p.id, 'pp_number', e.target.value)}
                placeholder="№ ПП"
                autoFocus={p.id === 'new-0'}
                style={{ width: 90, padding: '9px 10px', borderRadius: 10, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 12, color: '#0E1726', boxSizing: 'border-box' }}
              />
              <input
                type="date"
                value={p.pp_date}
                onChange={e => updateRow(p.id, 'pp_date', e.target.value)}
                style={{ width: 130, padding: '9px 10px', borderRadius: 10, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 12, color: '#0E1726', boxSizing: 'border-box' }}
              />
              <input
                type="number"
                value={p.amount}
                onChange={e => updateRow(p.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 12, color: '#0E1726', boxSizing: 'border-box', minWidth: 0 }}
              />
              <button
                onClick={() => removeRow(p.id)}
                title="Удалить платёж"
                type="button"
                style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: '#E0473B', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
              >
                ×
              </button>
            </div>
          ))}

          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 8,
            color: matches ? '#1E9E5A' : '#D97706', fontWeight: 600,
          }}>
            <span>Введено: {totalEntered.toLocaleString('ru-RU')} Br</span>
            <span>Нужно: {expected.toLocaleString('ru-RU')} Br</span>
          </div>

          {!matches && (
            <div style={{ fontSize: 11, color: '#D97706', marginTop: 4 }}>
              Сумма всех ПП должна совпадать со ставкой в заявке
            </div>
          )}
        </div>

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: matches ? (isCarrier ? '#E0473B' : '#1366F0') : '#D97706', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Сохраняю…' : matches ? 'Подтвердить оплату' : 'Сохранить (суммы не совпадают)'}
          </button>
        </div>
      </div>
    </div>
  )
}
