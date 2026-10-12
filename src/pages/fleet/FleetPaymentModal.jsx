import { useState } from 'react'
import { updateFleetOrder } from '../../api'
import { useToast } from '../../components/Toast'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { SwapText } from '../../components/Transitions'
import Switch from '../../components/Switch'
import DateInput from '../../components/DateInput'

const today = () => new Date().toISOString().slice(0, 10)
const fieldStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)',
  background: 'var(--fill)', fontSize: 14, color: 'var(--ink)', boxSizing: 'border-box',
}
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }

// Логика ввода ПП — как в экспедировании (OrderPaymentModal): номер ПП + дата,
// либо «наличными» без номера. Записывает paid / pp_number / payment_date.
export default function FleetPaymentModal({ order, onClose, onSaved }) {
  const { show } = useToast()
  useEscapeKey(onClose)
  const [ppNumber, setPpNumber] = useState(order.pp_number || '')
  const [payDate, setPayDate] = useState((order.payment_date || '').slice(0, 10) || today())
  const [isCash, setIsCash] = useState(!!order.paid_cash)
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (saving) return
    setSaving(true)
    try {
      await updateFleetOrder(order.id, {
        paid: true,
        paid_cash: isCash,
        pp_number: isCash ? '' : ppNumber.trim(),
        payment_date: payDate || today(),
      })
      await onSaved()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(var(--ink-rgb), 0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: 'var(--surface)', borderRadius: 24, width: '100%', maxWidth: 400, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-1e9e5a)', marginBottom: 6 }}>Оплата от клиента</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>{order.client_name || '—'} · {(order.rate || 0).toLocaleString('ru-RU')} Br</div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
          <Switch size="sm" checked={isCash} onChange={e => setIsCash(e.target.checked)} />
          Оплачено наличными (без ПП)
        </label>

        {!isCash && (
          <>
            <div style={lbl}>Номер ПП</div>
            <input value={ppNumber} onChange={e => setPpNumber(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirm() }} placeholder="напр. 214" autoFocus style={{ ...fieldStyle, marginBottom: 16 }} />
          </>
        )}

        <div style={lbl}>Дата оплаты</div>
        <DateInput type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ ...fieldStyle, marginBottom: 22 }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: 'var(--fill)', border: '1px solid var(--line)', fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>Отмена</button>
          <button onClick={confirm} disabled={saving} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: 'var(--bg-1e9e5a)', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
            <SwapText>{saving ? 'Сохраняю…' : 'Подтвердить оплату'}</SwapText>
          </button>
        </div>
      </div>
    </div>
  )
}
