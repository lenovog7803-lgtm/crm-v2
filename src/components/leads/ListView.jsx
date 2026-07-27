import { useState, useEffect } from 'react'
import { getLeads } from '../../api'
import { STAGES, stageById } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { logCall } from '../../api'

const FILTERS_KEY = 'leads_list_filters'

function loadFilters() {
  try { return JSON.parse(localStorage.getItem(FILTERS_KEY)) || {} } catch { return {} }
}

const thStyle = { textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }
const tdStyle = { padding: '12px 14px', fontSize: 13, color: '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }

export default function ListView({ industry }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(() => ({ search: '', stage: '', overdueOnly: false, ...loadFilters() }))
  const [activeLead, setActiveLead] = useState(null)
  const [editLead, setEditLead] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getLeads({ limit: 3000 }).then(r => setLeads(Array.isArray(r) ? r : (r?.items || []))).catch(console.error).finally(() => setLoading(false))
  }, [])

  useEffect(() => { localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)) }, [filters])

  const set = (k) => (v) => setFilters(p => ({ ...p, [k]: v }))

  const now = new Date().toISOString()
  const filtered = leads.filter(l => {
    if (industry && l.industry !== industry) return false
    if (filters.stage && l.stage !== filters.stage) return false
    if (filters.overdueOnly && !(l.next_call && l.next_call < now)) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const hit = [l.name, l.company, l.phone, l.contact_person, l.industry].filter(Boolean).some(v => v.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })

  const handleSave = async (data) => {
    if (!activeLead) return
    setSaving(true)
    try {
      const res = await logCall(activeLead.id, data)
      setLeads(prev => prev.map(l => l.id === activeLead.id ? res.lead : l))
      setActiveLead(null)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={filters.search}
          onChange={e => set('search')(e.target.value)}
          placeholder="Поиск по названию, телефону, контакту…"
          className="form-input"
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={filters.stage} onChange={e => set('stage')(e.target.value)} className="form-input" style={{ minWidth: 150 }}>
          <option value="">Все стадии</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5A6573', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.overdueOnly} onChange={e => set('overdueOnly')(e.target.checked)} />
          Только просроченные
        </label>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}

      {!loading && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Компания</th>
                <th style={thStyle}>Контакт</th>
                <th style={thStyle}>Телефон</th>
                <th style={thStyle}>Отрасль</th>
                <th style={thStyle}>Город</th>
                <th style={thStyle}>Стадия</th>
                <th style={thStyle}>Попыток</th>
                <th style={thStyle}>Следующий звонок</th>
                <th style={thStyle}>Всего звонков</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const st = stageById(l.stage)
                return (
                  <tr key={l.id} onClick={() => setActiveLead(l)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{l.name}</td>
                    <td style={tdStyle}>{l.contact_person || '—'}</td>
                    <td style={{ ...tdStyle, fontFamily: 'JetBrains Mono' }}>{l.phone}</td>
                    <td style={tdStyle}>{l.industry || '—'}</td>
                    <td style={tdStyle}>{l.city || '—'}</td>
                    <td style={tdStyle}><span style={{ padding: '3px 10px', borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>{st.label}</span></td>
                    <td style={tdStyle}>{l.call_attempts || 0}</td>
                    <td style={tdStyle}>{l.next_call ? new Date(l.next_call).toLocaleString('ru-RU') : '—'}</td>
                    <td style={tdStyle}>{l.total_calls || 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Нет лидов по фильтрам</div>}
        </div>
      )}

      {activeLead && (
        <div className="leads-call-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setActiveLead(null) }}>
          <style>{`.leads-call-modal .card { background: #FFFFFF; backdrop-filter: none; -webkit-backdrop-filter: none; border: 1px solid rgba(14,23,38,0.08); }`}</style>
          <div style={{ width: '100%', maxWidth: 1000, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button onClick={() => setActiveLead(null)} className="btn-ghost" style={{ alignSelf: 'flex-end' }}>Закрыть ✕</button>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
              <CallCard lead={activeLead} onEdit={setEditLead} />
              <ScriptPanel stage={activeLead?.stage} />
            </div>
            <CallOutcomeBar lead={activeLead} onSave={handleSave} saving={saving} />
          </div>
        </div>
      )}

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => {
            setLeads(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))
            setActiveLead(prev => prev && prev.id === updated.id ? { ...prev, ...updated } : prev)
          }}
        />
      )}
    </div>
  )
}
