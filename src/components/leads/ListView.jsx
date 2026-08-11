import { useState, useEffect, useRef } from 'react'
import { getLeads } from '../../api'
import { STAGES, stageById } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { logCall, claimLead } from '../../api'
import { SkeletonRow } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { initials, getGradient } from '../../utils'

const FILTERS_KEY = 'leads_list_filters'
const ROW_GRID = 'minmax(0, 1.6fr) minmax(0, 1fr) 130px 120px 90px'

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
        <select value={filters.stage} onChange={e => set('stage')(e.target.value)} className="form-input" style={{ minWidth: 150 }}>
          <option value="">Все стадии</option>
          {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5A6573', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.overdueOnly} onChange={e => set('overdueOnly')(e.target.checked)} />
          Только просроченные
        </label>
      </div>

      {loading && (
        <div className="card" style={{ padding: '4px 16px' }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState title="Нет лидов по фильтрам" subtitle="Попробуйте изменить стадию или поисковый запрос" />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: ROW_GRID,
            padding: '12px 20px',
            borderBottom: '1px solid rgba(14,23,38,0.06)',
            background: 'rgba(14,23,38,0.02)',
          }}>
            {['ЛИД', 'КОНТАКТЫ', 'СТАДИЯ', 'СЛЕДУЮЩИЙ ЗВОНОК', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>{h}</div>
            ))}
          </div>
          <div ref={scrollRef} onScroll={handleScroll} style={{ maxHeight: 640, overflowY: 'auto' }}>
            {visible.map((l, i) => {
              const st = stageById(l.stage)
              const [avA, avB] = getGradient(l.name || '')
              const overdue = l.next_call && l.next_call < now
              return (
                <div key={l.id} onClick={() => setActiveLead(l)}
                  style={{
                    display: 'grid', gridTemplateColumns: ROW_GRID, alignItems: 'center',
                    padding: '12px 20px', cursor: 'pointer',
                    borderBottom: i < visible.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none',
                    borderLeft: overdue ? '3px solid rgba(200,25,35,0.5)' : '3px solid transparent',
                    background: overdue ? 'rgba(200,25,35,0.03)' : 'transparent',
                    animation: 'rise 0.3s var(--ease) both', animationDelay: `${Math.min(i * 20, 240)}ms`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = overdue ? 'rgba(200,25,35,0.06)' : 'rgba(14,23,38,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = overdue ? 'rgba(200,25,35,0.03)' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 700,
                    }}>{initials(l.name)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                      {l.contact_person && <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.contact_person}</div>}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono', color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.phone || '—'}</div>
                    {(l.industry || l.city) && (
                      <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[l.industry, l.city].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div>
                    <span style={{ padding: '3px 10px', borderRadius: 8, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {l.next_call ? (
                      <>
                        <div style={{ fontSize: 12, color: overdue ? '#C81923' : '#0E1726', fontWeight: overdue ? 700 : 500 }}>
                          {new Date(l.next_call).toLocaleDateString('ru-RU')}
                        </div>
                        {(l.call_attempts || 0) > 0 && <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 1 }}>{l.call_attempts} попыт.</div>}
                      </>
                    ) : <span style={{ fontSize: 12, color: '#C4CAD4' }}>—</span>}
                  </div>
                  <div style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    {!l.assigned_to ? (
                      <button onClick={e => handleClaim(l.id, e)} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 11.5 }}>Взять</button>
                    ) : (
                      <svg width="8" height="13" viewBox="0 0 8 13" fill="none" style={{ marginLeft: 'auto' }}>
                        <path d="M1 1.5L6.5 7L1 12.5" stroke="#C4CAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,28,0.65)', zIndex: 1000, display: 'grid', padding: 20, overflowY: 'auto' }}>
          <div className="leads-call-modal" style={{ position: 'relative', width: '100%', maxWidth: 1000, margin: 'auto', borderRadius: 24, overflow: 'hidden', boxShadow: '0 40px 90px rgba(10,16,28,0.5)' }}>
            {/* Слой 1 — сплошная плотная подложка под блюром */}
            <div style={{ position: 'absolute', inset: 0, background: '#EEF1F5' }} />
            {/* Слой 2 — стекло поверх подложки */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)' }} />
            <style>{`.leads-call-modal .card { background: rgba(255,255,255,0.5); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%); border: 1px solid rgba(255,255,255,0.7); }`}</style>
            {/* Слой 3 — контент */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                {!activeLead.assigned_to && (
                  <button onClick={e => handleClaim(activeLead.id, e)} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}>Взять в работу</button>
                )}
                <button onClick={() => setActiveLead(null)} className="btn-ghost">Закрыть ✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
                <CallCard lead={activeLead} onEdit={setEditLead} />
                <ScriptPanel stage={activeLead?.stage} />
              </div>
              <CallOutcomeBar lead={activeLead} onSave={handleSave} saving={saving} />
            </div>
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
