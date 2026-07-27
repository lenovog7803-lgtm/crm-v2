import { useState, useEffect } from 'react'
import { getLeads, updateLead, logCall } from '../../api'
import { STAGES } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'

export default function KanbanView({ industry }) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)
  const [activeLead, setActiveLead] = useState(null)
  const [editLead, setEditLead] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getLeads({ limit: 3000 }).then(r => setLeads(Array.isArray(r) ? r : (r?.items || []))).catch(console.error).finally(() => setLoading(false))
  }, [])

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

  const renderColumn = (stage) => {
    const items = filtered.filter(l => (l.stage || 'new') === stage.id)
    return (
      <div
        key={stage.id}
        onDragOver={e => { e.preventDefault(); setOverStage(stage.id) }}
        onDragLeave={() => setOverStage(null)}
        onDrop={handleDrop(stage.id)}
        style={{ minWidth: 240, width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px' }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: stage.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 12.5, color: '#0E1726' }}>{stage.label}</span>
          <span style={{ fontSize: 11.5, color: '#A6AEB8', marginLeft: 'auto' }}>{items.length}</span>
        </div>
        <div className="card" style={{
          padding: 8, minHeight: 100, flex: 1, display: 'flex', flexDirection: 'column', gap: 8,
          background: overStage === stage.id ? 'rgba(19,102,240,0.06)' : undefined,
          border: overStage === stage.id ? '1.5px dashed rgba(19,102,240,0.4)' : undefined,
        }}>
          {items.map(l => (
            <div
              key={l.id}
              draggable
              onDragStart={() => setDragId(l.id)}
              onClick={() => setActiveLead(l)}
              style={{
                padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(14,23,38,0.08)', cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: 11, color: '#1366F0', marginTop: 3 }}>{l.phone}</div>
              {l.contact_person && <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>{l.contact_person}</div>}
              {l.next_call && <div style={{ fontSize: 10.5, color: '#F47A1F', marginTop: 4 }}>→ {new Date(l.next_call).toLocaleDateString('ru-RU')}</div>}
            </div>
          ))}
        </div>
      </div>
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
