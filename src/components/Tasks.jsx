import { useState, useEffect, useRef } from 'react'
import { getTasks, updateTask as apiUpdate, deleteTask as apiDelete } from '../api'
import { ModalOverlay, ModalHeader } from './Modal'
import { fmtDate } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'
import { SkeletonList } from './Skeleton'
import { SlidingTabs } from './SlidingTabs'
import CheckCircle from './CheckCircle'
import Select from './Select'
import { EmptyState } from './EmptyState'
import { useChangeFlash } from '../hooks/useChangeFlash'
import DateInput from './DateInput'

const TYPE_COLORS = { call: '#1366F0', reminder: '#D97706', payment: '#1E9E5A', other: '#8A93A0' }
const TYPE_BG = { call: 'rgba(19,102,240,0.1)', reminder: 'rgba(217,119,6,0.1)', payment: 'rgba(30,158,90,0.1)', other: 'rgba(138,147,160,0.1)' }
const TYPE_LABELS = { call: 'Звонок', reminder: 'Напоминание', payment: 'Оплата', other: 'Прочее' }

const inputStyle = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)',
  fontFamily: 'var(--font-sys)', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 13, fontWeight: 600, color: '#8A93A0', marginBottom: 6, paddingLeft: 4, display: 'block' }

export default function Tasks({ onAdd, refreshKey, search = '' }) {
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState([])
  const ownEdits = useRef(new Set())
  const liveFlash = useChangeFlash(tasks, t => [t.title, t.status, t.due_date, t.due_time, t.description].join('|'), ownEdits)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [editTask, setEditTask] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    // 'all' — this page has its own Все/Активные/Завершённые filter, so it
    // needs completed rows too (the backend default is pending-only now).
    getTasks('all')
      .then(r => setTasks(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleToggle = (task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    ownEdits.current.add(task.id)
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
      due_time: task.due_time || '',
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
        due_time: editTask.due_time,
        task_type: editTask.task_type,
        status: editTask.status,
      })
      setTasks(prev => prev.map(t => t.id === editTask.id ? { ...t, ...editTask } : t))
      setEditTask(null)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const today = new Date().toISOString().slice(0, 10)
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
      <div className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <SlidingTabs
            options={[{ key: 'active', label: 'Активные' }, { key: 'all', label: 'Все' }, { key: 'done', label: 'Завершённые' }]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <button className="btn-primary" onClick={onAdd} style={{ flexShrink: 0, padding: isMobile ? '9px 10px' : '11px 18px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {!isMobile && 'Новая задача'}
        </button>
      </div>

      {loading && (
        <SkeletonList rows={7} check />
      )}
      {!loading && filtered.length === 0 && (
        <div className="ios-list"><EmptyState title="Задач нет" subtitle="Всё сделано — можно выдохнуть. Новая задача появится здесь" /></div>
      )}
      {/* как в «Напоминаниях»: круглая отметка, название, тип и срок — подписью */}
      {!loading && filtered.length > 0 && (
        <div className="ios-list ios-list--check">
          {filtered.map(task => {
            const done = task.status === 'done'
            const typeKey = task.task_type || 'other'
            const overdue = !done && task.due_date && task.due_date < today
            return (
              <div key={task.id} className={`ios-row${liveFlash.has(task.id) ? ' row-flash' : ''}`} onClick={() => openEdit(task)}>
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex' }}>
                  <CheckCircle checked={done} onChange={() => handleToggle(task)} color="#1E9E5A" size={24} />
                </span>
                <div className="ios-row-text">
                  <div className="ios-row-title" style={{ fontWeight: 500, color: done ? '#A6AEB8' : '#0E1726', textDecoration: done ? 'line-through' : 'none' }}>
                    {task.title || task.description || '—'}
                  </div>
                  <div className="ios-row-sub">
                    <span style={{ color: TYPE_COLORS[typeKey] || TYPE_COLORS.other, fontWeight: 600 }}>{TYPE_LABELS[typeKey] || typeKey}</span>
                    {task.due_date && <span style={{ color: overdue ? '#FF3B30' : undefined, fontWeight: overdue ? 600 : undefined }}> · {fmtDate(task.due_date)}{task.due_time ? ` ${task.due_time}` : ''}</span>}
                    {task.description && task.title && <> · {task.description}</>}
                  </div>
                </div>
                <div className="ios-row-actions">
                  <button className="ios-row-icon ios-row-icon--red ios-row-del" title="Удалить" aria-label="Удалить задачу"
                    onClick={e => { e.stopPropagation(); handleDelete(task.id) }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editTask && (
        <ModalOverlay onClose={() => setEditTask(null)}>
          <ModalHeader title="Редактировать задачу" onClose={() => setEditTask(null)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Название</label>
              <input
                value={editTask.title}
                onChange={e => setEditTask(p => ({ ...p, title: e.target.value }))}
                placeholder="Название задачи..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Описание</label>
              <textarea
                value={editTask.description}
                onChange={e => setEditTask(p => ({ ...p, description: e.target.value }))}
                placeholder="Детали задачи..."
                style={{ ...inputStyle, height: 72, padding: '10px 12px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <div>
                <label style={labelStyle}>Тип</label>
                <Select value={editTask.task_type} onChange={e => setEditTask(p => ({ ...p, task_type: e.target.value }))} style={inputStyle}>
                  <option value="call">Звонок</option>
                  <option value="reminder">Напоминание</option>
                  <option value="payment">Оплата</option>
                  <option value="other">Прочее</option>
                </Select>
              </div>
              <div>
                <label style={labelStyle}>Статус</label>
                <Select value={editTask.status} onChange={e => setEditTask(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  <option value="pending">В работе</option>
                  <option value="done">Выполнено</option>
                </Select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Срок</label>
                <DateInput
                  type="date"
                  value={editTask.due_date}
                  onChange={e => setEditTask(p => ({ ...p, due_date: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Время</label>
                <input
                  type="time"
                  value={editTask.due_time}
                  onChange={e => setEditTask(p => ({ ...p, due_time: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditTask(null)} className="btn-ghost" style={{ flex: 1, height: 46, justifyContent: 'center' }}>Отмена</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, height: 46, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
