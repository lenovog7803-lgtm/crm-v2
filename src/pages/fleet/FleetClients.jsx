import { useState, useEffect } from 'react'
import { getFleetClients, deleteFleetClient } from '../../api'
import { useToast } from '../../components/Toast'
import { FleetClientModal } from './FleetClientModal'
import { Loader } from '../../components/Loader'
import { EmptyState } from '../../components/EmptyState'

export default function FleetClients({ onOpenClient }) {
  const { show } = useToast()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    getFleetClients()
      .then(r => setClients(r.clients || []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }, [show])

  const remove = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Удалить клиента?')) return
    try {
      await deleteFleetClient(id)
      setClients(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      show('Ошибка: ' + err.message, { type: 'error' })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 22, color: '#0E1726' }}>Клиенты</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Свой автопарк · {clients.length}</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          + Клиент
        </button>
      </div>

      {loading ? (
        <Loader padding={20} />
      ) : clients.length === 0 ? (
        <div className="card"><EmptyState title="Клиентов пока нет" subtitle="Добавьте первого клиента автопарка" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {clients.map(c => (
            <div
              key={c.id}
              onClick={() => onOpenClient?.(c.id)}
              title="Открыть карточку"
              className="card" style={{ padding: 18, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{c.name}</div>
                <button onClick={e => remove(e, c.id)} title="Удалить" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
              {(c.phone || c.contact_person) && (
                <div style={{ fontSize: 12, color: '#5A6573', marginTop: 6 }}>
                  {c.phone}{c.phone && c.contact_person ? ' · ' : ''}{c.contact_person}
                </div>
              )}
              {c.unp && <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>УНП {c.unp}</div>}
              {(c.legal_address || c.address) && <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>{c.legal_address || c.address}</div>}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <FleetClientModal
          onClose={() => setShowAdd(false)}
          onSaved={c => { setClients(prev => [...prev, c].sort((a, b) => (a.name || '').localeCompare(b.name || ''))); setShowAdd(false) }}
        />
      )}
    </div>
  )
}
