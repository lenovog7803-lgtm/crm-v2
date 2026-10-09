import { useState, useEffect } from 'react'
import { getCarriers, deleteCarrier as apiDelete } from '../api'
import { getGradient } from '../utils'
import { SkeletonList } from './Skeleton'
import { mouseOnly } from '../motion'

// Same cleanup as Clients.jsx — imported phone fields sometimes carry
// several numbers (and stray fragments) jammed into one comma-separated
// string; show the first one that actually looks like a phone number.
function primaryPhone(raw) {
  if (!raw) return ''
  const parts = String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean)
  return parts.find(p => (p.match(/\d/g) || []).length >= 6) || parts[0] || ''
}

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function Carriers({ onOpenCarrier, onAdd, refreshKey, search = '' }) {
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

  let visible = carriers
  if (search) {
    const q = search.toLowerCase()
    visible = carriers.filter(c =>
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.driver_name && c.driver_name.toLowerCase().includes(q)) ||
      (c.plate && c.plate.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(search)) ||
      (c.inn && c.inn.includes(search))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>
          {search ? `Найдено: ${visible.length}` : <>Всего перевозчиков: <span style={{ color: '#1366F0' }}>{carriers.length}</span></>}
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={onAdd}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить перевозчика
        </button>
      </div>

      {loading && (
        <SkeletonList />
      )}
      {!loading && (
      // iOS 26: список как в «Контактах» — одна группа-лист, строки с разделителями и › справа
      <div className="ios-list">
        {visible.map(carrier => {
          const name = carrier.company_name || carrier.name || '—'
          const driver = carrier.driver_name || carrier.driver || ''
          const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : (carrier.cap || '')
          const vehicleType = carrier.vehicle_type || ''
          const phone = primaryPhone(carrier.phone)
          const [avA, avB] = getGradient(name)
          const sub = [driver, cap, vehicleType, carrier.plate, carrier.regions].filter(Boolean).join(' · ')
          return (
            <div key={carrier.id} className="ios-row" onClick={() => onOpenCarrier(carrier.id)}>
              <div className="ios-row-avatar" style={{ background: `linear-gradient(160deg, ${avA} 0%, ${avB} 100%)` }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <div className="ios-row-text">
                <div className="ios-row-title">{name}</div>
                <div className="ios-row-sub">{sub || phone || 'Нет данных'}</div>
              </div>
              <span className="ios-row-badge"><StarIcon />{carrier.rating || '5.0'}</span>
                <div className="ios-row-actions" onClick={e => e.stopPropagation()}>
                  {phone && (
                    <a href={`tel:${phone}`} className="ios-row-icon ios-row-icon--blue" title="Позвонить" onClick={e => e.stopPropagation()}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    </a>
                  )}
                  <button onClick={e => handleDelete(e, carrier.id)} className="ios-row-icon ios-row-icon--red ios-row-del" title="Удалить">
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
