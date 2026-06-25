import { useState, useEffect } from 'react'
import { getTasks, updateTask as apiUpdate, deleteTask as apiDelete } from '../api'

const TYPE_COLORS = { call: '#1366F0', reminder: '#D97706', payment: '#1E9E5A', other: '#8A93A0' }
const TYPE_BG = { call: 'rgba(19,102,240,0.1)', reminder: 'rgba(217,119,6,0.1)', payment: 'rgba(30,158,90,0.1)', other: 'rgba(138,147,160,0.1)' }
const TYPE_LABELS = { call: 'Звонок', reminder: 'Напоминание', payment: 'Оплата', other: 'Прочее' }

export default function Tasks({ onAdd, refreshKey }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    getTasks()
      .then(r => setTasks(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleToggle = async (task) => {
    const newStatus = task.status === 'done' ? 'pending' : 'done'
    try {
      await apiUpdate(task.id, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id) => {
    await apiDelete(id).catch(console.error)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  let filtered = [...tasks]
  if (filter === 'active') filtered = filtered.filter(t => t.status !== 'done')
  if (filter === 'done') filtered = filtered.filter(t => t.status === 'done')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {[{k:'all',l:'Все'},{k:'active',l:'Активные'},{k:'done',l:'Завершённые'}].map(f => (
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
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
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
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <button onClick={() => handleToggle(task)} style={{
                width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                border: done ? 'none' : '2px solid rgba(14,23,38,0.2)',
                background: done ? '#1E9E5A' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
              }}>
                {done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: done ? '#A6AEB8' : '#0E1726',
                  textDecoration: done ? 'line-through' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{task.title}</div>
                {task.description && (
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
                <button onClick={() => handleDelete(task.id)} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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
    </div>
  )
}
