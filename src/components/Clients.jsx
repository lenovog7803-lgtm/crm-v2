import { useState, useEffect } from 'react'
import { getClients, deleteClient as apiDelete } from '../api'
import { initials, getGradient } from '../utils'

export default function Clients({ onOpenClient, onAdd, refreshKey }) {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>
          Всего клиентов: <span style={{ color: '#1366F0' }}>{clients.length}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить клиента
        </button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {clients.map(client => {
          const [avA, avB] = getGradient(client.name || '')
          const contact = client.contact_person || client.contact || ''
          const inn = client.inn || client.unp || ''
          const terms = client.payment_terms || client.terms || ''
          return (
            <div
              key={client.id} className="card"
              style={{ padding: '22px 22px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 50px -20px rgba(20,30,55,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '' }}
              onClick={() => onOpenClient(client.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 16,
                  boxShadow: `0 8px 20px -8px ${avB}80`,
                }}>{initials(client.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                  <div style={{ fontSize: 12.5, color: '#A6AEB8', marginTop: 2 }}>{contact}{client.city ? ' · ' + client.city : ''}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'rgba(14,23,38,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, color: '#A6AEB8', fontWeight: 600, marginBottom: 4 }}>УНП / ИНН</div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13, color: '#0E1726' }}>{inn || '—'}</div>
                </div>
                <div style={{ background: 'rgba(14,23,38,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, color: '#A6AEB8', fontWeight: 600, marginBottom: 4 }}>Условия</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>{terms || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(14,23,38,0.06)' }}>
                <div>
                  {client.phone && <div style={{ fontSize: 11, color: '#5A6573', fontWeight: 600 }}>{client.phone}</div>}
                  {client.email && <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>{client.email}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {client.phone && (
                    <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()} style={{
                      width: 32, height: 32, borderRadius: 10, background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </a>
                  )}
                  <button onClick={e => handleDelete(e, client.id)} style={{
                    width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(200,25,35,0.1)', color: '#C81923',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
