import { useState, useEffect } from 'react'
import { getLeads, updateLead as apiUpdate, deleteLead as apiDelete, addCallNote } from '../api'
import { initials, getGradient } from '../utils'
import { ModalOverlay, ModalHeader } from './Modal'

const STATUS_LABELS = {
  new: 'Новый', thinking: 'Думает', sent_kp: 'КП отправлено', callback: 'Перезвонить', won: 'Клиент', lost: 'Отказ',
  // Legacy statuses from DB
  contacted: 'Контакт', in_work: 'В работе', converted: 'Клиент',
}
const STATUS_COLORS = {
  new: '#1366F0', thinking: '#8A93A0', sent_kp: '#D97706', callback: '#F47A1F', won: '#1E9E5A', lost: '#C81923',
  contacted: '#8A93A0', in_work: '#D97706', converted: '#1E9E5A',
}
const STATUS_BG = {
  new: 'rgba(19,102,240,0.1)', thinking: 'rgba(138,147,160,0.1)', sent_kp: 'rgba(217,119,6,0.1)',
  callback: 'rgba(244,122,31,0.1)', won: 'rgba(30,158,90,0.1)', lost: 'rgba(200,25,35,0.1)',
  contacted: 'rgba(138,147,160,0.1)', in_work: 'rgba(217,119,6,0.1)', converted: 'rgba(30,158,90,0.1)',
}

const ALL_STATUSES = [
  { value: 'new', label: 'Новый' },
  { value: 'thinking', label: 'Думает' },
  { value: 'sent_kp', label: 'КП отправлено' },
  { value: 'callback', label: 'Перезвонить' },
  { value: 'won', label: 'Клиент' },
  { value: 'lost', label: 'Отказ' },
]

const inputStyle = {
  width: '100%', height: 38, padding: '0 12px', borderRadius: 10,
  border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)',
  fontFamily: 'Manrope', fontSize: 13, color: '#0E1726', outline: 'none', boxSizing: 'border-box',
}
const labelStyle = { fontSize: 12, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }

export default function Leads({ refreshKey, search = '' }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [industryFilter, setIndustryFilter] = useState('')
  const [editLead, setEditLead] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [noteLoading, setNoteLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getLeads({ limit: 500 })
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

  const handleCall = async lead => {
    const note = `Звонок ${new Date().toLocaleDateString('ru-RU')}`
    try {
      await addCallNote(lead.id, note)
      setLeads(prev => prev.map(l => l.id === lead.id ? {
        ...l, call_notes: [...(l.call_notes || []), { text: note, created_at: new Date().toISOString() }]
      } : l))
    } catch (e) { console.error(e) }
  }

  const handleDelete = async id => {
    await apiDelete(id).catch(console.error)
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  const openEdit = lead => {
    setEditLead({ ...lead })
    setNoteText('')
  }

  const handleSaveLead = async () => {
    if (!editLead) return
    setSaving(true)
    try {
      await apiUpdate(editLead.id, {
        name: editLead.name,
        phone: editLead.phone,
        contact_person: editLead.contact_person,
        industry: editLead.industry,
        status: editLead.status,
        next_call: editLead.next_call,
        notes: editLead.notes,
      })
      setLeads(prev => prev.map(l => l.id === editLead.id ? { ...l, ...editLead } : l))
      setEditLead(null)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleAddNote = async () => {
    if (!noteText.trim() || !editLead) return
    setNoteLoading(true)
    try {
      await addCallNote(editLead.id, noteText.trim())
      const newNote = { text: noteText.trim(), created_at: new Date().toISOString() }
      setLeads(prev => prev.map(l => l.id === editLead.id ? { ...l, call_notes: [...(l.call_notes || []), newNote] } : l))
      setEditLead(prev => ({ ...prev, call_notes: [...(prev.call_notes || []), newNote] }))
      setNoteText('')
    } catch (e) { console.error(e) }
    setNoteLoading(false)
  }

  const industries = [...new Set(leads.map(l => l.industry).filter(Boolean))].sort()

  const total = leads.length
  const inWork = leads.filter(l => ['in_work', 'thinking', 'sent_kp', 'callback'].includes(l.status)).length
  const newLeads = leads.filter(l => l.status === 'new').length
  const converted = leads.filter(l => ['converted', 'won'].includes(l.status)).length
  const maxVal = Math.max(total, 1)

  let filtered = [...leads]
  if (filter !== 'all') filtered = filtered.filter(l => l.status === filter)
  if (industryFilter) filtered = filtered.filter(l => l.industry === industryFilter)
  if (search) filtered = filtered.filter(l =>
    (l.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search) ||
    (l.industry || '').toLowerCase().includes(search.toLowerCase())
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
        {[{ k: 'all', l: 'Все' }, { k: 'new', l: 'Новые' }, { k: 'thinking', l: 'Думает' }, { k: 'sent_kp', l: 'КП' }, { k: 'callback', l: 'Перезвонить' }, { k: 'won', l: 'Клиент' }, { k: 'lost', l: 'Отказ' }].map(f => (
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: filter === f.k ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: filter === f.k ? '#fff' : '#5A6573',
          }}>{f.l}</button>
        ))}
        <div style={{ width: 1, height: 24, background: 'rgba(14,23,38,0.1)' }} />

        {industries.length > 0 && (
          <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className="form-input"
            style={{ height: 34, padding: '0 10px', fontSize: 12.5, minWidth: 140, borderRadius: 10 }}>
            <option value="">Все отрасли</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        )}

      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка...</div>}

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(lead => {
          const [avA, avB] = getGradient(lead.name || '')
          const callCount = (lead.call_notes || []).length
          const statusKey = lead.status || 'new'
          return (
            <div key={lead.id} className="card" style={{ padding: '20px 22px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onClick={() => openEdit(lead)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 30px rgba(14,23,38,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
            >
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

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
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
                {lead.phone && (
                  <span style={{ padding: '3px 10px', borderRadius: 8, background: 'rgba(19,102,240,0.07)', color: '#1366F0', fontSize: 11, fontWeight: 600 }}>
                    {lead.phone}
                  </span>
                )}
              </div>

              {lead.notes && (
                <div style={{ fontSize: 12.5, color: '#5A6573', marginBottom: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {lead.notes}
                </div>
              )}

              {lead.next_call && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F47A1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span style={{ fontSize: 12, color: '#F47A1F', fontWeight: 600 }}>Следующий звонок: {lead.next_call}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(14,23,38,0.06)', flexWrap: 'wrap' }}
                onClick={e => e.stopPropagation()}>
                <button onClick={() => handleCall(lead)} style={{
                  padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                  fontFamily: 'Manrope', fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  Звонок
                </button>
                <button onClick={() => handleDelete(lead.id)} style={{
                  marginLeft: 'auto', width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
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

      {/* Edit modal */}
      {editLead && (
        <ModalOverlay onClose={() => setEditLead(null)}>
          <ModalHeader title={editLead.name || 'Лид'} onClose={() => setEditLead(null)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>КОМПАНИЯ</label>
                <input value={editLead.name || ''} onChange={e => setEditLead(p => ({ ...p, name: e.target.value }))}
                  placeholder="Название компании" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ТЕЛЕФОН</label>
                <input value={editLead.phone || ''} onChange={e => setEditLead(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+375..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>КОНТАКТНОЕ ЛИЦО</label>
                <input value={editLead.contact_person || ''} onChange={e => setEditLead(p => ({ ...p, contact_person: e.target.value }))}
                  placeholder="Имя контакта" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ОТРАСЛЬ</label>
                <input value={editLead.industry || ''} onChange={e => setEditLead(p => ({ ...p, industry: e.target.value }))}
                  placeholder="Производство, строительство..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>СТАТУС</label>
                <select value={editLead.status || 'new'} onChange={e => setEditLead(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  {ALL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>СЛЕДУЮЩИЙ ЗВОНОК</label>
                <input type="date" value={editLead.next_call || ''} onChange={e => setEditLead(p => ({ ...p, next_call: e.target.value }))}
                  style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>ЗАМЕТКИ</label>
              <textarea value={editLead.notes || ''} onChange={e => setEditLead(p => ({ ...p, notes: e.target.value }))}
                placeholder="Общие заметки по клиенту..."
                style={{ ...inputStyle, height: 72, padding: '10px 12px', resize: 'vertical' }} />
            </div>

            {/* Call notes */}
            {(editLead.call_notes || []).length > 0 && (
              <div>
                <label style={labelStyle}>ИСТОРИЯ ЗВОНКОВ</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {(editLead.call_notes || []).slice(-8).reverse().map((n, i) => (
                    <div key={i} style={{ fontSize: 12.5, color: '#5A6573', padding: '7px 10px', background: 'rgba(14,23,38,0.04)', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: '#A6AEB8', marginRight: 8 }}>{n.created_at ? new Date(n.created_at).toLocaleDateString('ru-RU') : ''}</span>
                      {n.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>ДОБАВИТЬ ЗАМЕТКУ ПО ЗВОНКУ</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNote() }}
                  placeholder="Результат звонка, договорённости..."
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleAddNote} disabled={!noteText.trim() || noteLoading} style={{
                  height: 38, padding: '0 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: noteText.trim() ? '#0E1726' : 'rgba(14,23,38,0.08)',
                  color: noteText.trim() ? '#fff' : '#A6AEB8',
                  fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, flexShrink: 0,
                }}>Добавить</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setEditLead(null)} style={{
                flex: 1, height: 44, borderRadius: 13, border: '1px solid rgba(14,23,38,0.12)',
                background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope', fontSize: 14, fontWeight: 600, color: '#5A6573',
              }}>Отмена</button>
              <button onClick={handleSaveLead} disabled={saving} style={{
                flex: 2, height: 44, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: '#1366F0', color: '#fff', fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, opacity: saving ? 0.7 : 1,
              }}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
