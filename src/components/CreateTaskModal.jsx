import { useState } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createTask } from '../api'

export default function CreateTaskModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '', task_type: 'call', due_date: '', description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title) return
    setLoading(true)
    setError('')
    try {
      await createTask({ ...form, status: 'pending' })
      onSuccess()
    } catch (e) {
      setError('Ошибка при создании задачи')
    }
    setLoading(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Новая задача" onClose={onClose} />
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-field">
          <label className="form-label">НАЗВАНИЕ</label>
          <input className="form-input" placeholder="Описание задачи" value={form.title} onChange={e => set('title', e.target.value)} required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ТИП</label>
            <select className="form-input" value={form.task_type} onChange={e => set('task_type', e.target.value)}>
              <option value="call">Звонок</option>
              <option value="reminder">Напоминание</option>
              <option value="payment">Оплата</option>
              <option value="other">Прочее</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">СРОК</label>
            <input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label">ОПИСАНИЕ</label>
          <input className="form-input" placeholder="Напр. Заявка №А2-2847 · БелСталь" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        {error && <div style={{ fontSize: 12, color: '#C81923', textAlign: 'center' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
          <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center' }}>
            {loading ? 'Создание...' : 'Создать задачу'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  )
}
