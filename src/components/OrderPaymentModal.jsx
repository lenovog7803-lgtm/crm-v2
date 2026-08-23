import { useState } from 'react'
import { addPayment, deletePayment, getOrder, updateOrder } from '../api'
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
  // session — editable inline. The backend only exposes add/delete (no
  // in-place edit), so committing a change to one of these deletes the old
  // entry and re-adds it with the new values. A reopened modal must not
  // re-default a new row to the full rate on top of these, or saving would
  // double-count what's already paid.
  const savedField = isCarrier ? 'carrier_payments' : 'client_payments'
  const [existingPayments, setExistingPayments] = useState(
    (order[savedField] || [])
      .filter(p => !String(p.id).startsWith('legacy-'))
      .map(p => ({ ...p, _orig: { pp_number: p.pp_number, pp_date: p.pp_date, amount: p.amount } }))
  )
  const existingTotal = existingPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const remaining = expected - existingTotal

  const [payments, setPayments] = useState([
    { id: 'new-0', pp_number: '', pp_date: today(), amount: remaining > 0 ? remaining : 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Cash has no ПП number/date to record — checking this swaps the whole
  // ПП-entry section for a single date field, and skips both the "нет ПП"
  // and "сумма не сходится" checks for this side everywhere else in the app.
  const cashField = isCarrier ? 'carrier_cash' : 'client_cash'
  const [isCash, setIsCash] = useState(!!order[cashField])
  const [cashDate, setCashDate] = useState(
    (isCarrier ? order.carrier_paid_date : order.client_paid_date)?.slice(0, 10) || today()
  )

  const totalEntered = existingTotal + payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const matches = Math.abs(totalEntered - expected) < 0.01

  const updateExisting = (id, field, value) => {
    setExistingPayments(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const isExistingDirty = (p) =>
    (p.pp_number || '') !== (p._orig.pp_number || '') ||
    (p.pp_date || '') !== (p._orig.pp_date || '') ||
    Number(p.amount) !== Number(p._orig.amount)

  const commitExisting = async (p) => {
    setBusyId(p.id)
    try {
      onBeforeSave?.()
      await deletePayment(order.id, side, p.id)
      const res = await addPayment(order.id, side, {
        pp_number: (p.pp_number || '').trim(),
        pp_date: p.pp_date || today(),
        amount: Number(p.amount) || 0,
      })
      const created = res.payments?.[res.payments.length - 1]
      setExistingPayments(prev => prev.map(x => (x.id === p.id
        ? { ...created, _orig: { pp_number: created.pp_number, pp_date: created.pp_date, amount: created.amount } }
        : x)))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusyId(null)
  }

  const removeExisting = async (paymentId) => {
    setBusyId(paymentId)
    try {
      onBeforeSave?.()
      await deletePayment(order.id, side, paymentId)
      setExistingPayments(prev => prev.filter(p => p.id !== paymentId))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusyId(null)
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

  const saveCash = async () => {
    setSaving(true)
    setError('')
    try {
      onBeforeSave?.()
      const paidField = isCarrier ? 'carrier_paid' : 'client_paid'
      const dateField = isCarrier ? 'carrier_paid_date' : 'client_paid_date'
      await updateOrder(order.id, { [paidField]: true, [cashField]: true, [dateField]: cashDate })
      show(
        isCarrier
          ? `Отмечено наличными: перевозчику ${who} — ${expected.toLocaleString('ru-RU')} Br`
          : `Отмечено наличными: от клиента ${who} — ${expected.toLocaleString('ru-RU')} Br`,
        { type: 'success' }
      )
      onSaved?.()
      onClose()
    } catch (e) {
      setError('Ошибка: ' + e.message)
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  const save = async () => {
    if (isCash) return saveCash()
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

        <label style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18, cursor: 'pointer',
          padding: '10px 12px', borderRadius: 12, background: isCash ? '#FFF7E8' : '#F7F8FA',
          border: `1px solid ${isCash ? '#F0B84D' : '#E8EAEE'}`,
        }}>
          <input
            type="checkbox"
            checked={isCash}
            onChange={e => setIsCash(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#D97706', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13, fontWeight: 600, color: isCash ? '#8A5A00' : '#5A6573' }}>
            Оплачено наличными
          </span>
        </label>

        {isCash ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              Дата получения
            </div>
            <input
              type="date"
              value={cashDate}
              onChange={e => setCashDate(e.target.value)}
              style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid #E8EAEE', background: '#FFFFFF', fontSize: 13, color: '#0E1726', boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 6 }}>
              Без номера ПП — эта заявка не будет попадать в проверки «нет ПП» и «сумма не сходится».
            </div>
          </div>
        ) : (
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

          {existingPayments.map(p => {
            const dirty = isExistingDirty(p)
            const busy = busyId === p.id
            return (
              <div key={p.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', opacity: busy ? 0.5 : 1 }}>
                <input
                  value={p.pp_number}
                  onChange={e => updateExisting(p.id, 'pp_number', e.target.value)}
                  disabled={busy}
                  placeholder="№ ПП"
                  style={{ width: 90, padding: '9px 10px', borderRadius: 10, border: `1px solid ${dirty ? '#1366F0' : '#E8EAEE'}`, background: '#FFFFFF', fontSize: 12, color: '#0E1726', boxSizing: 'border-box' }}
                />
                <input
                  type="date"
                  value={p.pp_date}
                  onChange={e => updateExisting(p.id, 'pp_date', e.target.value)}
                  disabled={busy}
                  style={{ width: 130, padding: '9px 10px', borderRadius: 10, border: `1px solid ${dirty ? '#1366F0' : '#E8EAEE'}`, background: '#FFFFFF', fontSize: 12, color: '#0E1726', boxSizing: 'border-box' }}
                />
                <input
                  type="number"
                  value={p.amount}
                  onChange={e => updateExisting(p.id, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={busy}
                  style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: `1px solid ${dirty ? '#1366F0' : '#E8EAEE'}`, background: '#FFFFFF', fontSize: 12, color: '#0E1726', boxSizing: 'border-box', minWidth: 0 }}
                />
                {dirty && (
                  <button
                    onClick={() => commitExisting(p)}
                    disabled={busy}
                    title="Сохранить изменения"
                    type="button"
                    style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: '#1E9E5A', fontSize: 15, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✓
                  </button>
                )}
                <button
                  onClick={() => removeExisting(p.id)}
                  disabled={busy}
                  title="Удалить сохранённый платёж"
                  type="button"
                  style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: '#E0473B', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            )
          })}

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
        )}

        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: isCash || matches ? (isCarrier ? '#E0473B' : '#1366F0') : '#D97706', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Сохраняю…' : isCash ? 'Подтвердить оплату наличными' : matches ? 'Подтвердить оплату' : 'Сохранить (суммы не совпадают)'}
          </button>
        </div>
      </div>
    </div>
  )
}
