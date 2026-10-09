import { useState, useEffect } from 'react'
import { getClients, deleteClient as apiDelete } from '../api'
import { initials, getGradient } from '../utils'
import { SkeletonList } from './Skeleton'
import { mouseOnly } from '../motion'

// Imported data sometimes has several phone numbers jammed into one field,
// separated by commas — occasionally with a stray fragment mixed in (e.g.
// a partial extension left over from a spreadsheet cell). Pick the first
// token that actually looks like a phone number instead of dumping the
// raw string into the card.
function primaryPhone(raw) {
  if (!raw) return ''
  const parts = String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return parts.find(p => (p.match(/\d/g) || []).length >= 6) || parts[0] || ''
}

export default function Clients({ onOpenClient, onAdd, refreshKey, search = '' }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getClients()
      .then(r => setClients(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await apiDelete(id).catch(console.error)
    setClients(prev => prev.filter(c => c.id !== id))
  }

  let visible = clients
  if (search) {
    const q = search.toLowerCase()
    visible = clients.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(search)) ||
      (c.inn && c.inn.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(q))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>
          {search ? `Найдено: ${visible.length}` : `Всего клиентов: `}{!search && <span style={{ color: '#1366F0' }}>{clients.length}</span>}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить клиента
        </button>
      </div>

      {loading && (
        <SkeletonList />
      )}
      {!loading && (
      // iOS 26: список как в «Контактах» — одна группа-лист, строки с разделителями и › справа
      <div className="ios-list">
        {visible.map(client => {
          const [avA, avB] = getGradient(client.name || '')
          const contact = client.contact_person || client.contact || ''
          const inn = client.inn || client.unp || ''
          const terms = client.payment_terms || client.terms || ''
          const phone = primaryPhone(client.phone)
          const sub = [contact, client.city, inn && `УНП ${inn}`, terms].filter(Boolean).join(' · ')
          return (
            <div key={client.id} className="ios-row" onClick={() => onOpenClient(client.id)}>
              <div className="ios-row-avatar" style={{ background: `linear-gradient(160deg, ${avA} 0%, ${avB} 100%)` }}>{initials(client.name)}</div>
              <div className="ios-row-text">
                <div className="ios-row-title">{client.name}</div>
                <div className="ios-row-sub">{sub || phone || client.email || 'Нет данных'}</div>
              </div>
                <div className="ios-row-actions" onClick={e => e.stopPropagation()}>
                  {phone && (
                    <a href={`tel:${phone}`} className="ios-row-icon ios-row-icon--blue" title="Позвонить" onClick={e => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </a>
                  )}
                  <button onClick={e => handleDelete(e, client.id)} className="ios-row-icon ios-row-icon--red ios-row-del" title="Удалить">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
                <svg className="ios-row-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5 1.5 6.5 6.5 1.5 11.5"/></svg>
            </div>
          )
        })}
      </div>

      )}
    </div>
  )
}
