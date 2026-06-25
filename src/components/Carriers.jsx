import { useState, useEffect } from 'react'
import { getCarriers, deleteCarrier as apiDelete } from '../api'
import { getGradient } from '../utils'

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function Carriers({ onOpenCarrier, onAdd, refreshKey }) {
  const [carriers, setCarriers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getCarriers()
      .then(r => setCarriers(Array.isArray(r) ? r : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await apiDelete(id).catch(console.error)
    setCarriers(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>
          Всего перевозчиков: <span style={{ color: '#1366F0' }}>{carriers.length}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить перевозчика
        </button>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {carriers.map(carrier => {
          const name = carrier.company_name || carrier.name || '—'
          const driver = carrier.driver_name || carrier.driver || ''
          const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : (carrier.cap || '—')
          const [avA, avB] = getGradient(name)
          return (
            <div
              key={carrier.id} className="card"
              style={{ padding: '22px 22px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 50px -20px rgba(20,30,55,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '' }}
              onClick={() => onOpenCarrier(carrier.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 16, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="3" width="15" height="13" rx="1"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14.5, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <div style={{ fontSize: 12.5, color: '#A6AEB8', marginTop: 2 }}>{driver}</div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(217,119,6,0.1)', borderRadius: 8, padding: '4px 10px', flexShrink: 0,
                }}>
                  <StarIcon />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#D97706' }}>{carrier.rating || '5.0'}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div style={{ background: 'rgba(14,23,38,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, color: '#A6AEB8', fontWeight: 600, marginBottom: 4 }}>Грузоподъёмность</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>{cap}</div>
                </div>
                <div style={{ background: 'rgba(14,23,38,0.04)', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, color: '#A6AEB8', fontWeight: 600, marginBottom: 4 }}>Тип ТС</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>{carrier.vehicle_type || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(14,23,38,0.06)' }}>
                <div>
                  {carrier.plate && (
                    <div style={{ fontSize: 11, color: '#A6AEB8', marginBottom: 2 }}>
                      Номер: <span style={{ color: '#0E1726', fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 12 }}>{carrier.plate}</span>
                    </div>
                  )}
                  {carrier.regions && (
                    <div style={{ fontSize: 11, color: '#A6AEB8' }}>Регионы: <span style={{ color: '#5A6573', fontWeight: 600 }}>{carrier.regions}</span></div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {carrier.phone && (
                    <a href={`tel:${carrier.phone}`} onClick={e => e.stopPropagation()} style={{
                      width: 32, height: 32, borderRadius: 10, background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </a>
                  )}
                  <button onClick={e => handleDelete(e, carrier.id)} style={{
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
