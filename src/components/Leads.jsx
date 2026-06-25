import { useState, useEffect } from 'react'
import { getLeads, updateLead as apiUpdate, deleteLead as apiDelete, addCallNote } from '../api'
import { initials, getGradient } from '../utils'

const STATUS_LABELS = { new: 'Новый', contacted: 'Контакт', in_work: 'В работе', converted: 'Клиент', lost: 'Потерян' }
const STATUS_COLORS = { new: '#1366F0', contacted: '#8A93A0', in_work: '#D97706', converted: '#1E9E5A', lost: '#C81923' }
const STATUS_BG = { new: 'rgba(19,102,240,0.1)', contacted: 'rgba(138,147,160,0.1)', in_work: 'rgba(217,119,6,0.1)', converted: 'rgba(30,158,90,0.1)', lost: 'rgba(200,25,35,0.1)' }

export default function Leads({ refreshKey }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    getLeads({ limit: 200 })
      .then(r => setLeads(Array.isArray(r) ? r : (r.items || [])))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [refreshKey])

  const setStatus = async (lead, status) => {
    try {
      await apiUpdate(lead.id, { status })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status } : l))
    } catch (e) { console.error(e) }
  }

  const handleCall = async (lead) => {
    const note = new Date().toLocaleDateString('ru-RU')
    try {
      await addCallNote(lead.id, `Звонок ${note}`)
      setLeads(prev => prev.map(l => l.id === lead.id ? {
        ...l,
        call_notes: [...(l.call_notes || []), { text: `Звонок ${note}`, created_at: new Date().toISOString() }]
      } : l))
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (id) => {
    await apiDelete(id).catch(console.error)
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const total = leads.length
  const inWork = leads.filter(l => l.status === 'in_work').length
  const newLeads = leads.filter(l => l.status === 'new').length
  const converted = leads.filter(l => l.status === 'converted').length
  const maxVal = Math.max(total, 1)

  let filtered = [...leads]
  if (filter !== 'all') filtered = filtered.filter(l => l.status === filter)
  if (search) filtered = filtered.filter(l =>
    (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats + funnel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) 1.2fr', gap: 14 }}>
        {[
          { label: 'Всего', value: total, color: '#0E1726', bg: 'rgba(14,23,38,0.06)' },
          { label: 'Новые', value: newLeads, color: '#1366F0', bg: 'rgba(19,102,240,0.08)' },
          { label: 'В работе', value: inWork, color: '#D97706', bg: 'rgba(217,119,6,0.08)' },
          { label: 'Конвертированы', value: converted, color: '#1E9E5A', bg: 'rgba(30,158,90,0.08)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '18px 18px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{
              fontFamily: 'Onest', fontWeight: 800, fontSize: 34, color: k.color,
              background: k.bg, borderRadius: 12, padding: '6px 14px', display: 'inline-block', lineHeight: 1,
            }}>{k.value}</div>
          </div>
        ))}
        <div className="card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 12 }}>ВОРОНКА</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Новые', val: newLeads, color: '#1366F0' },
              { label: 'В работе', val: inWork, color: '#D97706' },
              { label: 'Конвертированы', val: converted, color: '#1E9E5A' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#5A6573', fontWeight: 500 }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: row.color }}>{row.val}</span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(14,23,38,0.07)' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: row.color, width: (row.val / maxVal * 100) + '%', transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {[{k:'all',l:'Все'},{k:'new',l:'Новые'},{k:'contacted',l:'Контакт'},{k:'in_work',l:'В работе'},{k:'converted',l:'Клиент'},{k:'lost',l:'Потерян'}].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: filter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: filter === f.k ? '#fff' : '#5A6573',
          }}>{f.l}</button>
        ))}
        <div style={{ width: 1, height: 24, background: 'rgba(14,23,38,0.1)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Поиск..."
          className="form-input"
          style={{ height: 34, padding: '0 12px', fontSize: 12.5, minWidth: 180 }}
        />
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {filtered.map(lead => {
          const [avA, avB] = getGradient(lead.name || '')
          const callCount = (lead.call_notes || []).length
          const statusKey = lead.status || 'new'
          return (
            <div key={lead.id} className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 15, flexShrink: 0,
                  background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                }}>{initials(lead.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14.5, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[lead.company, lead.city].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 8, flexShrink: 0,
                  background: STATUS_BG[statusKey] || STATUS_BG.new,
                  color: STATUS_COLORS[statusKey] || STATUS_COLORS.new,
                  fontSize: 11, fontWeight: 600,
                }}>{STATUS_LABELS[statusKey] || statusKey}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {lead.industry && (
                  <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(244,122,31,0.1)', color: '#F47A1F', fontSize: 11, fontWeight: 600 }}>
                    {lead.industry}
                  </span>
                )}
                {callCount > 0 && (
                  <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(14,23,38,0.07)', color: '#5A6573', fontSize: 11, fontWeight: 600 }}>
                    Звонков: {callCount}
                  </span>
                )}
              </div>

              {lead.notes && (
                <div style={{ fontSize: 12.5, color: '#5A6573', marginBottom: 12, lineHeight: 1.5 }}>{lead.notes}</div>
              )}

              {lead.next_call && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F47A1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#F47A1F', fontWeight: 600 }}>Следующий звонок: {lead.next_call}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(14,23,38,0.06)', flexWrap: 'wrap' }}>
                {lead.status === 'new' && (
                  <button onClick={() => setStatus(lead, 'contacted')} style={{
                    padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(138,147,160,0.1)', color: '#8A93A0',
                    fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  }}>Контакт</button>
                )}
                {(lead.status === 'new' || lead.status === 'contacted') && (
                  <button onClick={() => setStatus(lead, 'in_work')} style={{
                    padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(217,119,6,0.1)', color: '#D97706',
                    fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  }}>В работу</button>
                )}
                {lead.status === 'in_work' && (
                  <button onClick={() => setStatus(lead, 'converted')} style={{
                    padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(30,158,90,0.1)', color: '#1E9E5A',
                    fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  }}>Стал клиентом</button>
                )}
                {lead.status !== 'lost' && lead.status !== 'converted' && (
                  <button onClick={() => setStatus(lead, 'lost')} style={{
                    padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(200,25,35,0.08)', color: '#C81923',
                    fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  }}>Потерян</button>
                )}
                <button onClick={() => handleCall(lead)} style={{
                  padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                  fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                  Звонок
                </button>
                <button onClick={() => handleDelete(lead.id)} style={{
                  marginLeft: 'auto', width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
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
      </div>
      {!loading && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Нет лидов</div>
      )}
    </div>
  )
}
