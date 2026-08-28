import { useState, useEffect } from 'react'
import { ModalOverlay, ModalHeader } from './Modal'
import { createTask, getAllUsers } from '../api'
import { useAuth } from '../AuthContext'

const ROLE_LABEL = { admin: 'директор', director: 'директор', manager: 'менеджер' }

export default function CreateTaskModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const role = user?.user?.role
  const isDirector = role === 'director' || role === 'admin'

  const [form, setForm] = useState({
    title: '', task_type: 'call', due_date: '', due_time: '', description: '', assigned_user_id: '',
  })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!isDirector) return
    getAllUsers().then(r => setUsers(r.users || r || [])).catch(() => {})
  }, [isDirector])

  const handleSubmit = async e => {
    e.preventDefault()
    if (!form.title) return
    setLoading(true)
    setError('')
    try {
      await createTask({ ...form, status: 'pending', assigned_user_id: form.assigned_user_id || null })
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <div className="form-field">
            <label className="form-label">ВРЕМЯ</label>
            <input className="form-input" type="time" value={form.due_time} onChange={e => set('due_time', e.target.value)} />
          </div>
          {isDirector && (
            <div className="form-field">
              <label className="form-label">НАЗНАЧИТЬ</label>
              <select className="form-input" value={form.assigned_user_id} onChange={e => set('assigned_user_id', e.target.value)}>
                <option value="">Не назначать</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}{u.role ? ` · ${ROLE_LABEL[u.role] || u.role}` : ''}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="form-field">
          <label className="form-label">ОПИСАНИЕ</label>
          <input className="form-input" placeholder="Напр. Заявка №А2-2847 · БелСталь" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        {form.due_time && !form.due_date && (
          <div style={{ fontSize: 11.5, color: '#8A93A0' }}>Укажите дату — уведомление придёт в этот день в {form.due_time}.</div>
        )}
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
