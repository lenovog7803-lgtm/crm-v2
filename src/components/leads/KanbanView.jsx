import { useState, useEffect, useMemo, useRef } from 'react'
import { getLeads, updateLead, logCall, claimLead } from '../../api'
import { useRealtime } from '../../hooks/useRealtime'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { STAGES } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'

const PAGE_SIZE = 10

function KanbanColumn({ stage, items, dragId, overStage, onDragStart, onDragOver, onDragLeave, onDrop, onOpenLead, onClaim }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const listRef = useRef(null)

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = new Date(a.stage_changed_at || a.updated_at || a.created_at || 0).getTime()
      const db = new Date(b.stage_changed_at || b.updated_at || b.created_at || 0).getTime()
      return db - da
    })
  }, [items])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [stage.id])

  const visible = sorted.slice(0, visibleCount)

  const handleScroll = () => {
    const el = listRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      setVisibleCount(prev => Math.min(prev + PAGE_SIZE, sorted.length))
    }
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ minWidth: 240, width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: stage.color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 12.5, color: '#0E1726' }}>{stage.label}</span>
        <span style={{ fontSize: 11.5, color: '#A6AEB8', marginLeft: 'auto' }}>{sorted.length}</span>
      </div>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="card"
        style={{
          padding: 8, minHeight: 100, maxHeight: 560, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
          background: overStage === stage.id ? 'rgba(19,102,240,0.06)' : undefined,
          border: overStage === stage.id ? '1.5px dashed rgba(19,102,240,0.4)' : undefined,
        }}
      >
        {visible.map(l => (
          <div
            key={l.id}
            draggable
            onDragStart={() => onDragStart(l.id)}
            onClick={() => onOpenLead(l)}
            onMouseEnter={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = 'rgba(19,102,240,0.3)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px -12px rgba(20,30,55,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(14,23,38,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            style={{
              padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(14,23,38,0.08)', cursor: 'pointer',
              transition: 'background 0.15s var(--ease), border-color 0.15s var(--ease), transform 0.15s var(--ease), box-shadow 0.15s var(--ease)',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1366F0', marginTop: 3 }}>{l.phone}</div>
            {l.contact_person && <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>{l.contact_person}</div>}
            {l.next_call && <div style={{ fontSize: 10.5, color: '#F47A1F', marginTop: 4 }}>→ {new Date(l.next_call).toLocaleDateString('ru-RU')}</div>}
            {!l.assigned_to && (
              <button
                onClick={e => { e.stopPropagation(); onClaim(l.id) }}
                style={{ marginTop: 6, width: '100%', padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(19,102,240,0.1)', color: '#1366F0', fontSize: 11, fontWeight: 700 }}
              >
                Взять в работу
              </button>
            )}
          </div>
        ))}
        {visibleCount < sorted.length && (
          <div style={{ textAlign: 'center', padding: 10, fontSize: 11, color: '#8A93A0' }}>
            ещё {sorted.length - visibleCount}, докрутите вниз
          </div>
        )}
      </div>
    </div>
  )
}

export default function KanbanView({ industry }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  const [activeLead, setActiveLead] = useState(null)
  const [editLead, setEditLead] = useState(null)
  const [saving, setSaving] = useState(false)
  const { celebrate } = useCelebration()
  useEscapeKey(() => setActiveLead(null), !!activeLead)

  const loadLeads = (showLoading = true) => {
    if (showLoading) setLoading(true)
    return getLeads({ limit: 3000 }).then(r => setLeads(Array.isArray(r) ? r : (r?.items || []))).catch(console.error).finally(() => setLoading(false))
  }

  useEffect(() => { loadLeads() }, [])

  useRealtime((event) => {
    if (event.type === 'lead_updated') loadLeads(false)
  })

  const filtered = industry ? leads.filter(l => l.industry === industry) : leads
  const activeStages = STAGES.filter(s => s.active)
  const closedStages = STAGES.filter(s => !s.active)

  const moveTo = async (leadId, stageId) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: stageId } : l))
    try { await updateLead(leadId, { stage: stageId }) } catch (e) { console.error(e) }
  }

  const handleDrop = (stageId) => (e) => {
    e.preventDefault()
    setOverStage(null)
    if (dragId) moveTo(dragId, stageId)
    setDragId(null)
  }

  const handleClaim = async (leadId) => {
    try {
      await claimLead(leadId)
      setLeads(prev => {
        const next = prev.map(l => l.id === leadId ? { ...l, assigned_to: myId } : l)
        // Claiming acts like opening the card — jump straight into the call window.
        setActiveLead(next.find(l => l.id === leadId) || null)
        return next
      })
    } catch (e) { console.error(e) }
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

  const renderColumn = (stage) => {
    const items = filtered.filter(l => (l.stage || 'new') === stage.id)
    return (
      <KanbanColumn
        key={stage.id}
        stage={stage}
        items={items}
        dragId={dragId}
        overStage={overStage}
        onDragStart={setDragId}
        onDragOver={e => { e.preventDefault(); setOverStage(stage.id) }}
        onDragLeave={() => setOverStage(null)}
        onDrop={handleDrop(stage.id)}
        onOpenLead={setActiveLead}
        onClaim={handleClaim}
      />
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {activeStages.map(renderColumn)}
        <div style={{ width: 1, background: 'rgba(14,23,38,0.1)', flexShrink: 0 }} />
        {closedStages.map(renderColumn)}
      </div>

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
                  <button onClick={() => handleClaim(activeLead.id)} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}>Взять в работу</button>
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
