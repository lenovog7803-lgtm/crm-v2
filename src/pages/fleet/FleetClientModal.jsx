import { useState } from 'react'
import { createFleetClient, updateFleetClient } from '../../api'
import { useToast } from '../../components/Toast'
import { SwapText } from '../../components/Transitions'

const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #E8EAEE', fontSize: 13, background: '#FFFFFF', boxSizing: 'border-box', width: '100%' }

export const MAIN_FIELDS = [
  { key: 'name', label: 'Название', full: true },
  { key: 'phone', label: 'Телефон' },
  { key: 'contact_person', label: 'Контактное лицо' },
  { key: 'unp', label: 'УНП' },
  { key: 'director', label: 'Директор' },
  { key: 'legal_address', label: 'Юридический адрес', full: true },
  { key: 'postal_address', label: 'Почтовый адрес', full: true },
  { key: 'basis', label: 'Действует на основании', full: true },
]

export const BANK_FIELDS = [
  { key: 'bank', label: 'Банк', full: true },
  { key: 'bik', label: 'БИК' },
  { key: 'rs', label: 'Расчётный счёт' },
]

const ALL = [...MAIN_FIELDS, ...BANK_FIELDS]

export function FleetClientModal({ initial, onClose, onSaved }) {
  const { show } = useToast()
  const editing = !!initial
  const [form, setForm] = useState(() => Object.fromEntries(ALL.map(f => [f.key, initial?.[f.key] ?? ''])))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim() }
      const res = editing ? await updateFleetClient(initial.id, payload) : await createFleetClient(payload)
      onSaved(res || { ...initial, ...payload })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
      setSaving(false)
    }
  }

  const grid = (fields) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {fields.map(f => (
        <input
          key={f.key}
          value={form[f.key]}
          onChange={e => set(f.key, e.target.value)}
          placeholder={f.label}
          autoFocus={f.key === 'name'}
          style={{ ...fieldStyle, gridColumn: f.full ? '1 / -1' : 'auto' }}
        />
      ))}
    </div>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 560, padding: 26, boxShadow: '0 40px 80px rgba(20,30,55,0.28)' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 18 }}>
          {editing ? 'Изменить клиента' : 'Новый клиент автопарка'}
        </div>

        {grid(MAIN_FIELDS)}

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #F0F1F4', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Банковские реквизиты
          </div>
          {grid(BANK_FIELDS)}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button onClick={save} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: form.name.trim() ? '#1366F0' : '#C4CAD4', color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            <SwapText>{saving ? 'Сохраняю…' : editing ? 'Сохранить' : 'Добавить'}</SwapText>
          </button>
        </div>
      </div>
    </div>
  )
}
