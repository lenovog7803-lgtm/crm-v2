import { useState, useEffect } from 'react'
import { getClient, deleteClient as apiDelete, getOrders } from '../api'
import { initials, fmtMoney, statusLabel, statusColor, statusBg, getGradient } from '../utils'

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, padding: '8px 0', borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
      <span style={{ fontSize: 12, color: '#A6AEB8', fontWeight: 500, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', textAlign: 'right', fontFamily: mono ? 'JetBrains Mono' : undefined, wordBreak: 'break-all' }}>{value || '—'}</span>
    </div>
  )
}

export default function ClientDetail({ clientId, onBack, onDelete, onOpenOrder }) {
  const [client, setClient] = useState(null)
  const [clientOrders, setClientOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clientId) return
    setLoading(true)
    Promise.all([
      getClient(clientId),
      getOrders({ client_id: clientId }).catch(() => getOrders()),
    ]).then(([c, orders]) => {
      setClient(c)
      const arr = Array.isArray(orders) ? orders : []
      setClientOrders(arr.filter(o => o.client_id === clientId || String(o.client_id) === String(clientId)))
    }).catch(console.error).finally(() => setLoading(false))
  }, [clientId])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>
  if (!client) return <div style={{ padding: 60, textAlign: 'center', color: '#A6AEB8' }}>Клиент не найден</div>

  const [avA, avB] = getGradient(client.name || '')
  const contact = client.contact_person || ''
  const inn = client.inn || ''
  const address = client.legal_address || ''
  const terms = client.payment_terms || ''

  const handleDelete = async () => {
    await apiDelete(client.id).catch(console.error)
    onDelete(client.id)
    onBack()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn-ghost" onClick={onBack}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Клиенты
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
          Удалить клиента
        </button>
      </div>

      <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: '0 auto 16px',
          background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 24,
          boxShadow: `0 12px 30px -12px ${avB}80`,
        }}>{initials(client.name)}</div>
        <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 22, color: '#0E1726', letterSpacing: '-0.02em' }}>{client.name}</div>
        {contact && <div style={{ fontSize: 14, color: '#A6AEB8', marginTop: 4 }}>{contact}</div>}
        {client.phone && (
          <a href={`tel:${client.phone}`} style={{ display: 'block', marginTop: 8, fontSize: 15, fontWeight: 600, color: '#1366F0', textDecoration: 'none' }}>{client.phone}</a>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>РЕКВИЗИТЫ</div>
          <Row label="УНП / ИНН" value={inn} mono />
          <Row label="Юр. адрес" value={address} />
          <Row label="Направления" value={client.directions} />
          <Row label="Груз" value={client.cargo_types} />
          <Row label="Условия оплаты" value={terms} />
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>БАНКОВСКИЕ РЕКВИЗИТЫ</div>
          <Row label="Банк" value={client.bank_name} />
          <Row label="Счёт" value={client.bank_account} mono />
          <Row label="БИК" value={client.bank_bik} mono />
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ДОПОЛНИТЕЛЬНО</div>
          {client.email && <Row label="Email" value={client.email} />}
          {client.kpp && <Row label="КПП" value={client.kpp} mono />}
          {client.notes && <Row label="Примечания" value={client.notes} />}
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <div className="section-label" style={{ marginBottom: 10 }}>ИСТОРИЯ ЗАЯВОК</div>
          {clientOrders.length === 0 ? (
            <div style={{ color: '#A6AEB8', fontSize: 13, padding: '12px 0' }}>Нет заявок</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {clientOrders.slice(0, 15).map(o => (
                <div
                  key={o.id}
                  onClick={() => onOpenOrder && onOpenOrder(o.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 10px', borderRadius: 10,
                    borderBottom: '1px solid rgba(14,23,38,0.05)',
                    cursor: onOpenOrder ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (onOpenOrder) e.currentTarget.style.background = 'rgba(19,102,240,0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0', fontWeight: 600 }}>{o.order_number || o.id}</div>
                    <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {o.route_from && o.route_to ? `${o.route_from} → ${o.route_to}` : '—'}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 13, color: '#0E1726', flexShrink: 0 }}>
                    {(o.client_rate || 0).toLocaleString('ru-RU')} Br
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, flexShrink: 0,
                    background: statusBg(o.status), color: statusColor(o.status),
                    fontSize: 11, fontWeight: 600,
                  }}>{statusLabel(o.status)}</span>
                  {onOpenOrder && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A6AEB8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
