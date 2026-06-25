import { useState, useEffect } from 'react'
import { getCarrier, deleteCarrier as apiDelete } from '../api'
import { fmtMoney, statusLabel, statusColor, statusBg, getGradient } from '../utils'

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
      <span style={{ fontSize: 12, color: '#A6AEB8', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', textAlign: 'right', fontFamily: mono ? 'JetBrains Mono' : undefined, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#D97706" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}

export default function CarrierDetail({ carrierId, onBack, onDelete }) {
  const [carrier, setCarrier] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!carrierId) return
    setLoading(true)
    getCarrier(carrierId).then(setCarrier).catch(console.error).finally(() => setLoading(false))
  }, [carrierId])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>
  if (!carrier) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Перевозчик не найден</div>

  const name = carrier.company_name || carrier.name || '—'
  const driver = carrier.driver_name || carrier.driver || ''
  const cap = carrier.capacity_tons ? carrier.capacity_tons + ' т' : '—'
  const [avA, avB] = getGradient(name)

  const handleDelete = async () => {
    await apiDelete(carrier.id).catch(console.error)
    onDelete(carrier.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Перевозчики
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={handleDelete} style={{
          padding: '9px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
          background: 'rgba(200,25,35,0.1)', color: '#C81923',
          fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
          </svg>
          Удалить
        </button>
      </div>

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: '0 auto 16px',
          background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 12px 30px -12px ${avB}80`,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="1"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 22, color: '#0E1726', letterSpacing: '-0.02em' }}>{name}</div>
        <div style={{ fontSize: 14, color: '#A6AEB8', marginTop: 4 }}>{driver}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          <StarIcon />
          <span style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>{carrier.rating || '5.0'}</span>
        </div>
        {carrier.phone && (
          <a href={`tel:${carrier.phone}`} style={{ display: 'block', marginTop: 8, fontSize: 15, fontWeight: 600, color: '#1366F0', textDecoration: 'none' }}>{carrier.phone}</a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ИНФОРМАЦИЯ</div>
          <Row label="УНП" value={carrier.unp} mono />
          <Row label="Адрес" value={carrier.address || carrier.legal_address} />
          <Row label="Грузоподъёмность" value={cap} />
          <Row label="Тип ТС" value={carrier.vehicle_type} />
          <Row label="Номер ТС" value={carrier.plate} mono />
          <Row label="Регионы" value={carrier.regions} />
          <Row label="Груз" value={carrier.cargo_types} />
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>БАНКОВСКИЕ РЕКВИЗИТЫ</div>
          <Row label="Банк" value={carrier.bank_name || carrier.bank} />
          <Row label="Р/С" value={carrier.bank_account || carrier.rs} mono />
          <Row label="БИК" value={carrier.bank_bik || carrier.bik} mono />
          {carrier.email && <Row label="Email" value={carrier.email} />}
          {carrier.notes && <Row label="Примечания" value={carrier.notes} />}
        </div>
      </div>
    </div>
  )
}
