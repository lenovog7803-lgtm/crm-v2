import { useState, useEffect } from 'react'
import { getTrash, restoreTrash } from '../api'

const TYPE_LABELS = {
  orders: 'Заявка',
  clients: 'Клиент',
  carriers: 'Перевозчик',
  leads: 'Лид',
  tasks: 'Задача',
}

const TYPE_ICONS = {
  orders: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  clients: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  carriers: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  leads: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  tasks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
}

function daysLeft(deletedAt) {
  if (!deletedAt) return 30
  const ms = 30 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(deletedAt).getTime())
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

function itemTitle(item) {
  return item.order_number
    ? `Заявка №${item.order_number}`
    : item.client_name || item.carrier_name || item.company_name || item.name
    || item.title || item.description || item.id
}

export default function Trash() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [restoring, setRestoring] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    getTrash().then(r => setItems(Array.isArray(r) ? r : [])).catch(() => setItems([])).finally(() => setLoading(false))
  }, [])

  const handleRestore = async (item) => {
    setRestoring(item.id)
    try {
      await restoreTrash(item._collection, item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } catch (e) { console.error(e) }
    setRestoring(null)
  }

  const filtered = filter === 'all' ? items : items.filter(i => i._collection === filter)
  const counts = items.reduce((acc, i) => { acc[i._collection] = (acc[i._collection] || 0) + 1; return acc }, {})

  const chipStyle = (k) => ({
    padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
    background: filter === k ? '#0E1726' : 'rgba(14,23,38,0.06)',
    color: filter === k ? '#fff' : '#5A6573',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(200,25,35,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C81923', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>Корзина</div>
          <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>Удалённые элементы хранятся 30 дней, затем удаляются навсегда</div>
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: 'Onest', fontWeight: 800, fontSize: 22, color: items.length > 0 ? '#C81923' : '#A6AEB8' }}>
          {items.length}
        </div>
      </div>

      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
        <button style={chipStyle('all')} onClick={() => setFilter('all')}>Все ({items.length})</button>
        {Object.entries(counts).map(([col, cnt]) => (
          <button key={col} style={chipStyle(col)} onClick={() => setFilter(col)}>
            {TYPE_LABELS[col] || col} ({cnt})
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑</div>
            <div style={{ fontSize: 14, color: '#A6AEB8', fontWeight: 600 }}>Корзина пуста</div>
            <div style={{ fontSize: 12, color: '#C4CAD4', marginTop: 6 }}>Удалённые элементы появятся здесь</div>
          </div>
        )}
        {!loading && filtered.map((item, i) => {
          const days = daysLeft(item.deleted_at)
          const urgent = days <= 3
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: 'rgba(200,25,35,0.08)', color: '#C81923',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {TYPE_ICONS[item._collection] || TYPE_ICONS.tasks}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {itemTitle(item)}
                </div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 2 }}>
                  {TYPE_LABELS[item._collection] || item._collection}
                  {item.deleted_at && ` · Удалено ${new Date(item.deleted_at).toLocaleDateString('ru-RU')}`}
                </div>
              </div>
              <div style={{
                fontSize: 11.5, fontWeight: 600, padding: '4px 10px', borderRadius: 8,
                background: urgent ? 'rgba(200,25,35,0.1)' : 'rgba(14,23,38,0.05)',
                color: urgent ? '#C81923' : '#8A93A0', flexShrink: 0,
              }}>
                {days === 0 ? 'Сегодня удалится' : `${days} дн.`}
              </div>
              <button
                onClick={() => handleRestore(item)}
                disabled={restoring === item.id}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(19,102,240,0.25)',
                  background: 'rgba(19,102,240,0.06)', color: '#1366F0',
                  fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(19,102,240,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(19,102,240,0.06)'}
              >
                {restoring === item.id ? '...' : 'Восстановить'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
