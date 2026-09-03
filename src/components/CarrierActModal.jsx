import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

// Gates "получено от перевозчика" behind the act number — the checkbox only
// ticks once the number is entered and confirmed here, not on a plain click.
export default function CarrierActModal({ initialValue, initialDate, onClose, onConfirm }) {
  useEscapeKey(onClose)
  const [value, setValue] = useState(initialValue || '')
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const confirm = async () => {
    if (!value.trim() || saving) return
    setSaving(true)
    await onConfirm(value.trim(), date)
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)',
      zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 380,
        padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: '#1E9E5A', marginBottom: 6,
        }}>
          Документы от перевозчика получены
        </div>
        <div style={{ fontSize: 14, color: '#5A6573', marginBottom: 20 }}>
          Укажите номер акта — без него отметка не сохранится
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Номер акта
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            placeholder="напр. 214"
            autoFocus
            style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 14, color: '#0E1726', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setValue('Б/Н')}
            style={{
              padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', whiteSpace: 'nowrap',
              background: value.trim().toUpperCase() === 'Б/Н' ? 'rgba(19,102,240,0.1)' : '#F7F8FA',
              color: value.trim().toUpperCase() === 'Б/Н' ? '#1366F0' : '#5A6573',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Акт Б/Н
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Дата акта
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 14, color: '#0E1726', boxSizing: 'border-box', marginBottom: 22 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={saving || !value.trim()}
            style={{
              flex: 2, padding: 13, borderRadius: 12, border: 'none',
              background: value.trim() ? '#1E9E5A' : '#C4CAD4', color: '#FFFFFF', fontSize: 14, fontWeight: 700,
              cursor: value.trim() && !saving ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Сохраняю…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>
  )
}
