import { useState } from 'react'
import { createLead, updateLead, deleteLead, findDuplicates } from '../../api'
import { STAGES } from '../../constants/leads'
import { ModalOverlay, ModalHeader } from '../Modal'
import { iosConfirm, confirmNoDuplicates } from '../IOSAlert'
import { SwapText } from '../Transitions'
import Select from '../Select'

const FIELDS = [
  ['name', 'Название компании'], ['phone', 'Телефон'],
  ['contact_person', 'Контактное лицо'], ['contact_position', 'Должность'],
  ['email', 'Email'], ['website', 'Сайт'],
  ['industry', 'Отрасль'], ['city', 'Город'],
  ['region', 'Регион'],
]

// Правка лида; без lead.id — создание нового. Общая модалка CRM (на телефоне — шторка).
export default function LeadEditModal({ lead, onClose, onSaved, onDeleted }) {
  const isNew = !lead?.id
  const [form, setForm] = useState({ stage: 'new', ...lead })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.name?.trim() || !form.phone?.trim()) { setError('Укажите название и телефон'); return }
    setSaving(true)
    setError('')
    if (isNew && !(await confirmNoDuplicates(() => findDuplicates('leads', { phone: form.phone, name: form.name }), 'такой лид'))) { setSaving(false); return }
    try {
      const data = Object.fromEntries([...FIELDS.map(([k]) => k), 'stage', 'notes'].map(k => [k, form[k] ?? '']))
      const saved = isNew ? await createLead(data) : await updateLead(lead.id, data)
      onSaved?.({ ...lead, ...form, ...(saved?.id ? saved : {}) })
      onClose()
    } catch (err) {
      console.error(err)
      setError('Не сохранилось. Проверьте интернет и попробуйте ещё раз.')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!(await iosConfirm(`Удалить лида «${lead.name}»? Он попадёт в корзину, оттуда его можно вернуть.`))) return
    try {
      await deleteLead(lead.id)
      onDeleted?.(lead.id)
      onClose()
    } catch (err) {
      console.error(err)
      setError('Не удалилось. Попробуйте ещё раз.')
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={isNew ? 'Новый лид' : 'Редактировать лида'} onClose={onClose} />
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          {FIELDS.map(([k, label], i) => (
            <div className="form-field" key={k}>
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[k] || ''} onChange={set(k)} autoFocus={isNew && i === 0} />
            </div>
          ))}
          <div className="form-field">
            <label className="form-label">Стадия</label>
            <Select className="form-input" value={form.stage || 'new'} onChange={set('stage')}>
              {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Заметки</label>
          <textarea className="form-input" value={form.notes || ''} onChange={set('notes')} style={{ height: 80, resize: 'vertical' }} />
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--fg-c81923)', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {!isNew && onDeleted && (
            <button type="button" className="btn-ghost" onClick={handleDelete} style={{ justifyContent: 'center', color: 'var(--fg-e0473b)' }}>Удалить</button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={saving} style={{ flex: 2, justifyContent: 'center' }}>
            <SwapText>{saving ? 'Сохранение…' : isNew ? 'Добавить лида' : 'Сохранить'}</SwapText>
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
