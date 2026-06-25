import { useState, useEffect } from 'react'
import { getTasks, updateTask as apiUpdate, deleteTask as apiDelete } from '../api'
import { ModalOverlay, ModalHeader } from './Modal'

const TYPE_COLORS = { call: '#1366F0', reminder: '#D97706', payment: '#1E9E5A', other: '#8A93A0' }
const TYPE_BG = { call: 'rgba(19,102,240,0.1)', reminder: 'rgba(217,119,6,0.1)', payment: 'rgba(30,158,90,0.1)', other: 'rgba(138,147,160,0.1)' }
const TYPE_LABELS = { call: 'Звонок', reminder: 'Напоминание', payment: 'Оплата', other: 'Прочее' }

const inputStyle = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)',
  fontFamily: 'Manrope', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }

export default function Tasks({ onAdd, refreshKey, search = '' }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [editTask, setEditTask] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTasks()
      .then(r => setTasks(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleToggle = (task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    apiUpdate(task.id, { status: newStatus }).catch(console.error)
  }

  const handleDelete = async id => {
    await apiDelete(id).catch(console.error)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const openEdit = task => {
    setEditTask({
      id: task.id,
      title: task.title || task.description || '',
      description: task.description || '',
      due_date: task.due_date || '',
      task_type: task.task_type || 'other',
      status: task.status || 'pending',
    })
  }

  const handleSave = async () => {
    if (!editTask) return
    setSaving(true)
    try {
      await apiUpdate(editTask.id, {
        title: editTask.title,
        description: editTask.description,
        due_date: editTask.due_date,
        task_type: editTask.task_type,
        status: editTask.status,
      })
      setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...editTask } : t))
      setEditTask(null)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  let filtered = [...tasks]
  if (filter === 'active') filtered = filtered.filter(t => t.status !== 'done')
  if (filter === 'done') filtered = filtered.filter(t => t.status === 'done')
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(t =>
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {[{ k: 'all', l: 'Все' }, { k: 'active', l: 'Активные' }, { k: 'done', l: 'Завершённые' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: filter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: filter === f.k ? '#fff' : '#5A6573',
          }}>{f.l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Новая задача
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        {!loading && filtered.map((task, i) => {
          const done = task.status === 'done'
          const typeKey = task.task_type || 'other'
          return (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none',
              transition: 'background 0.12s', cursor: 'pointer',
            }}
              onClick={() => openEdit(task)}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <button onClick={e => { e.stopPropagation(); handleToggle(task) }} style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                border: done ? 'none' : '2px solid rgba(14,23,38,0.2)',
                background: done ? '#1E9E5A' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
                {done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: done ? '#A6AEB8' : '#0E1726',
                  textDecoration: done ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{task.title || task.description || '—'}</div>
                {task.description && task.title && (
                  <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{
                  padding: '3px 9px', borderRadius: 8,
                  background: TYPE_BG[typeKey] || TYPE_BG.other,
                  color: TYPE_COLORS[typeKey] || TYPE_COLORS.other,
                  fontSize: 11, fontWeight: 600,
                }}>{TYPE_LABELS[typeKey] || typeKey}</span>
                {task.due_date && (
                  <span style={{ fontSize: 12, color: '#A6AEB8', minWidth: 80 }}>{task.due_date}</span>
                )}
                <button onClick={e => { e.stopPropagation(); handleDelete(task.id) }} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#A6AEB8', fontSize: 14 }}>Нет задач</div>
        )}
      </div>

      {/* Edit modal */}
      {editTask && (
        <ModalOverlay onClose={() => setEditTask(null)}>
          <ModalHeader title="Редактировать задачу" onClose={() => setEditTask(null)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>НАЗВАНИЕ</label>
              <input
                value={editTask.title}
                onChange={e => setEditTask(p => ({ ...p, title: e.target.value }))}
                placeholder="Название задачи..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>ОПИСАНИЕ</label>
              <textarea
                value={editTask.description}
                onChange={e => setEditTask(p => ({ ...p, description: e.target.value }))}
                placeholder="Детали задачи..."
                style={{ ...inputStyle, height: 72, padding: '10px 12px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>ТИП</label>
                <select value={editTask.task_type} onChange={e => setEditTask(p => ({ ...p, task_type: e.target.value }))} style={inputStyle}>
                  <option value="call">Звонок</option>
                  <option value="reminder">Напоминание</option>
                  <option value="payment">Оплата</option>
                  <option value="other">Прочее</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>СТАТУС</label>
                <select value={editTask.status} onChange={e => setEditTask(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  <option value="pending">В работе</option>
                  <option value="done">Выполнено</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>СРОК</label>
              <input
                type="date"
                value={editTask.due_date}
                onChange={e => setEditTask(p => ({ ...p, due_date: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditTask(null)} style={{
                flex: 1, height: 44, borderRadius: 13, border: '1px solid rgba(14,23,38,0.12)',
                background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope', fontSize: 14, fontWeight: 600, color: '#5A6573',
              }}>Отмена</button>
              <button onClick={handleSave} disabled={saving} style={{
                flex: 2, height: 44, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: '#1366F0', color: '#fff', fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
