import GlassDialog from './GlassDialog'
import { useState } from 'react'
import { SwapText } from './Transitions'
import DateInput from './DateInput'

// Gates "получено от перевозчика" behind the act number — the checkbox only
// ticks once the number is entered and confirmed here, not on a plain click.
export default function CarrierActModal({ initialValue, initialDate, onClose, onConfirm }) {
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
    <div className="dash-modal-scrim" onClick={onClose}>
      <GlassDialog label="Акт перевозчика" onDismiss={onClose} className="dash-modal dash-form" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, padding: 26 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: 'var(--fg-1e9e5a)', marginBottom: 6,
        }}>
          Документы от перевозчика получены
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Укажите номер акта — без него отметка не сохранится
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Номер акта
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirm() }}
            placeholder="напр. 214"
            autoFocus
            style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--fill)', fontSize: 14, color: 'var(--ink)', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setValue('Б/Н')}
            style={{
              padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', whiteSpace: 'nowrap',
              background: value.trim().toUpperCase() === 'Б/Н' ? 'rgba(var(--rgb-19-102-240), 0.1)' : 'var(--fill)',
              color: value.trim().toUpperCase() === 'Б/Н' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Акт Б/Н
          </button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
          Дата акта
        </div>
        <DateInput
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--fill)', fontSize: 14, color: 'var(--ink)', boxSizing: 'border-box', marginBottom: 22 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button data-dialog-dismiss onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
            Отмена
          </button>
          <button
            onClick={confirm}
            disabled={saving || !value.trim()} className="btn-primary" style={{ flex: 2, background: value.trim() ? 'var(--fg-1e9e5a)' : 'var(--text-quaternary)', boxShadow: 'none', justifyContent: 'center' }}
          >
            <SwapText>{saving ? 'Сохраняю…' : 'Подтвердить'}</SwapText>
          </button>
        </div>
      </GlassDialog>
    </div>
  )
}
