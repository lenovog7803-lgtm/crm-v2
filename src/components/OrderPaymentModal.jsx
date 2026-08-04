import { useState } from 'react'
import { markPayment } from '../api'
import { useToast } from './Toast'

export default function OrderPaymentModal({ order, side, onClose, onSaved }) {
  const { show } = useToast()
  const [ppNumber, setPpNumber] = useState('')
  const [ppDate, setPpDate] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const isCarrier = side === 'carrier'
  const amount = isCarrier ? order.carrier_rate : order.client_rate
  const who = isCarrier ? order.carrier_name : order.client_name

  const save = async () => {
    setSaving(true)
    try {
      await markPayment(order.id, side, { paid: true, pp_number: ppNumber.trim() || null, pp_date: ppDate })
      show(
        isCarrier
          ? `Отмечено: перевозчику ${who} — ${(amount || 0).toLocaleString('ru-RU')} Br`
          : `Отмечено: от клиента ${who} — ${(amount || 0).toLocaleString('ru-RU')} Br`,
        {
          type: 'success',
          actionLabel: 'Отменить',
          onAction: async () => {
            await markPayment(order.id, side, { paid: false })
            onSaved?.()
          },
        }
      )
      onSaved?.()
      onClose()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setSaving(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)',
      zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 420,
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
          {(amount || 0).toLocaleString('ru-RU')} Br
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Номер ПП <span style={{ fontWeight: 400, textTransform: 'none' }}>(необязательно)</span>
        </div>
        <input
          value={ppNumber}
          onChange={e => setPpNumber(e.target.value)}
          placeholder="напр. 1245"
          autoFocus
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 14, color: '#0E1726', boxSizing: 'border-box', marginBottom: 16 }}
        />

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Дата платежа
        </div>
        <input
          type="date"
          value={ppDate}
          onChange={e => setPpDate(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 14, color: '#0E1726', boxSizing: 'border-box', marginBottom: 22 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: isCarrier ? '#E0473B' : '#1366F0', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Сохраняю…' : 'Подтвердить оплату'}
          </button>
        </div>
      </div>
    </div>
  )
}
