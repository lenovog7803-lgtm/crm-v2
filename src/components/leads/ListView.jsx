import { useState, useEffect, useRef } from 'react'
import { getLeads } from '../../api'
import { STAGES, stageById } from '../../constants/leads'
import LeadEditModal from './LeadEditModal'
import { logCall, claimLead } from '../../api'
import { SkeletonList } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { initials, getGradient } from '../../utils'
import CallWindow from './CallWindow'
import Select from '../Select'
import Switch from '../Switch'

const FILTERS_KEY = 'leads_list_filters'

function loadFilters() {
  try { return JSON.parse(localStorage.getItem(FILTERS_KEY)) || {} } catch { return {} }
}

export default function ListView({ industry }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(() => ({ search: '', stage: '', overdueOnly: false, ...loadFilters() }))
  const [activeLead, setActiveLead] = useState(null)
  useEscapeKey(() => setActiveLead(null), !!activeLead)
  const [editLead, setEditLead] = useState(null)
  const [saving, setSaving] = useState(false)
  const [visibleCount, setVisibleCount] = useState(10)
  const scrollRef = useRef(null)
  const { celebrate } = useCelebration()

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

  useEffect(() => { setVisibleCount(10) }, [filters, industry])

  const visible = filtered.slice(0, visibleCount)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setVisibleCount(prev => Math.min(prev + 10, filtered.length))
    }
  }

  const handleSave = async (data) => {
    if (!activeLead) return
    setSaving(true)
    try {
      const res = await logCall(activeLead.id, data)
      setLeads(prev => prev.map(l => l.id === activeLead.id ? res.lead : l))
      if (data.outcome === 'won') celebrate()
      setActiveLead(null)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleClaim = async (leadId, e) => {
    e.stopPropagation()
    try {
      await claimLead(leadId)
      setLeads(prev => {
        const next = prev.map(l => l.id === leadId ? { ...l, assigned_to: myId } : l)
        // Claiming acts like opening the row — jump straight into the call window.
        setActiveLead(next.find(l => l.id === leadId) || null)
        return next
      })
    } catch (e) { console.error(e) }
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
        <Select value={filters.stage} onChange={e => set('stage')(e.target.value)} className="form-input" style={{ minWidth: 150 }}>
          <option value="">Все стадии</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5A6573', cursor: 'pointer' }}>
          <Switch size="sm" checked={filters.overdueOnly} onChange={e => set('overdueOnly')(e.target.checked)} />
          Только просроченные
        </label>
      </div>

      {loading && (
        <SkeletonList />
      )}

      {!loading && filtered.length === 0 && (
        <div className="ios-list">
          <EmptyState title="Нет лидов по фильтрам" subtitle="Попробуйте изменить стадию или поисковый запрос" />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="ios-list">
          <div ref={scrollRef} onScroll={handleScroll} style={{ maxHeight: 640, overflowY: 'auto' }}>
            {visible.map(l => {
              const st = stageById(l.stage)
              const [avA, avB] = getGradient(l.name || '')
              const overdue = l.next_call && l.next_call < now
              const sub = [l.contact_person, l.phone, l.industry, l.city].filter(Boolean).join(' · ')
              return (
                <div key={l.id} className="ios-row" onClick={() => setActiveLead(l)}>
                  <div className="ios-row-avatar" style={{ background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)` }}>{initials(l.name)}</div>
                  <div className="ios-row-text">
                    <div className="ios-row-title">{l.name}</div>
                    {sub && <div className="ios-row-sub">{sub}</div>}
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 99, background: st.bg, color: st.color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{st.label}</span>
                  <div className="ios-row-hide-sm" style={{ width: 86, textAlign: 'right', flexShrink: 0 }}>
                    {l.next_call ? (
                      <>
                        <div style={{ fontSize: 13, color: overdue ? '#FF3B30' : '#0E1726', fontWeight: overdue ? 600 : 500, fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(l.next_call).toLocaleDateString('ru-RU')}
                        </div>
                        {(l.call_attempts || 0) > 0 && <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1 }}>{l.call_attempts} попыт.</div>}
                      </>
                    ) : <span style={{ fontSize: 13, color: '#C4CAD4' }}>—</span>}
                  </div>
                  {!l.assigned_to ? (
                    <button onClick={e => handleClaim(l.id, e)} style={{ padding: '6px 16px', borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(118,118,128,0.12)', color: '#1366F0', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sys)', flexShrink: 0 }}>Взять</button>
                  ) : (
                    <svg className="ios-row-chevron" width="8" height="13" viewBox="0 0 8 13" fill="none">
                      <path d="M1 1.5L6.5 7L1 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              )
            })}
            {visibleCount < filtered.length && (
              <div style={{ textAlign: 'center', padding: 14, fontSize: 12, color: '#8A93A0' }}>
                показано {visible.length} из {filtered.length} · докрутите вниз
              </div>
            )}
          </div>
        </div>
      )}

      {activeLead && (
        <CallWindow lead={activeLead} onClose={() => setActiveLead(null)} onClaim={(id, e) => handleClaim(id, e)}
          onEdit={setEditLead} onSave={handleSave} saving={saving} />
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
