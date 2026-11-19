import { useState } from 'react'
import { createFleetClient, updateFleetClient } from '../../api'
import { useToast } from '../../components/Toast'
import { SwapText } from '../../components/Transitions'
import { findBankByAccount, findBankByBik, formatPhone, formatIBAN } from '../../utils'

const fieldStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, background: 'var(--surface)', boxSizing: 'border-box', width: '100%' }

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
  { key: 'rs', label: 'Расчётный счёт (IBAN)' },
  { key: 'bik', label: 'БИК' },
  { key: 'bank', label: 'Банк', full: true },
]

const ALL = [...MAIN_FIELDS, ...BANK_FIELDS]

export function FleetClientModal({ initial, onClose, onSaved }) {
  const { show } = useToast()
  const editing = !!initial
  const [form, setForm] = useState(() => Object.fromEntries(ALL.map(f => [f.key, initial?.[f.key] ?? ''])))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => {
    const next = { ...p, [k]: v }
    if (k === 'rs') {
      const d = findBankByAccount(v)
      if (d) { next.bik = d.bik; next.bank = d.bank }
    } else if (k === 'bik') {
      const d = findBankByBik(v)
      if (d) { next.bank = d.bank }
    }
    return next
  })

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

  const handleBlur = (k) => {
    if (k === 'rs') set('rs', formatIBAN(form.rs))
    if (k === 'phone') set('phone', formatPhone(form.phone))
  }

  const grid = (fields) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {fields.map(f => (
        <input
          key={f.key}
          value={form[f.key]}
          onChange={e => set(f.key, e.target.value)}
          onBlur={() => handleBlur(f.key)}
          placeholder={f.label}
          autoFocus={f.key === 'name'}
          style={{ ...fieldStyle, gridColumn: f.full ? '1 / -1' : 'auto' }}
        />
      ))}
    </div>
  )

  return (
    <div onClick={onClose} className="dash-modal-scrim">
      <div onClick={e => e.stopPropagation()} className="dash-modal dash-form" style={{ maxWidth: 560, padding: 26 }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)', marginBottom: 18 }}>
          {editing ? 'Изменить клиента' : 'Новый клиент автопарка'}
        </div>

        {grid(MAIN_FIELDS)}

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--fill-2)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Банковские реквизиты
          </div>
          {grid(BANK_FIELDS)}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
            <SwapText>{saving ? 'Сохраняю…' : editing ? 'Сохранить' : 'Добавить'}</SwapText>
          </button>
        </div>
      </div>
    </div>
  )
}
