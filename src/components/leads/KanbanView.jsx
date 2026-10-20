import { useState, useEffect, useMemo, useRef } from 'react'
import { getLeads, updateLead, logCall, claimLead, getAllUsers } from '../../api'
import { useRealtime } from '../../hooks/useRealtime'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { STAGES, stageOf } from '../../constants/leads'
import LeadEditModal from './LeadEditModal'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { Loader } from '../Loader'
import { initials, getGradient } from '../../utils'
import CallWindow from './CallWindow'

const PAGE_SIZE = 10
const CARD_W = 248

const dayLabel = (iso) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')

// Карточка лида. Сама не двигается: при перетаскивании её копия едет за курсором (Board), а здесь — бледный след
function LeadCard({ lead, users, ghost, lifted, onPointerDown, onClaim }) {
  const manager = users[lead.assigned_to]
  const [a, b] = getGradient(manager || lead.assigned_to || '')
  const overdue = lead.next_call && new Date(lead.next_call) < new Date()
  return (
    <div
      onPointerDown={onPointerDown}
      className="kanban-card"
      style={{
        padding: '12px 13px', borderRadius: 16, background: 'var(--surface)', cursor: lifted ? 'grabbing' : 'grab',
        border: '1px solid rgba(var(--ink-rgb), 0.07)', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation',
        opacity: ghost ? 0.35 : 1,
        boxShadow: lifted ? '0 24px 48px -16px rgba(20,30,55,0.45), 0 0 0 1px rgba(var(--rgb-19-102-240), 0.25)' : '0 1px 2px rgba(20,30,55,0.06)',
        transition: lifted ? 'none' : 'opacity .15s var(--ease), box-shadow .15s var(--ease)',
      }}
    >
      {lead.industry && (
        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 7, marginBottom: 7, fontSize: 10.5, fontWeight: 600, color: 'var(--fg-1366f0)', background: 'rgba(var(--rgb-19-102-240), 0.09)' }}>{lead.industry}</span>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
      {lead.phone && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{lead.phone}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        {lead.assigned_to ? (
          <span title={manager || 'Менеджер'} style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 9.5, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${a}, ${b})` }}>
            {initials(manager || '?')}
          </span>
        ) : (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onClaim(lead.id) }}
            style={{ padding: '4px 10px', borderRadius: 99, border: 'none', cursor: 'pointer', background: 'rgba(var(--rgb-19-102-240), 0.1)', color: 'var(--fg-1366f0)', fontSize: 11.5, fontWeight: 600 }}
          >Взять</button>
        )}
        {lead.next_call && (
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: overdue ? 'var(--fg-e0473b)' : 'var(--text-tertiary)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
            {dayLabel(lead.next_call)}
          </span>
        )}
      </div>
    </div>
  )
}

function Column({ stage, items, users, drag, over, onCardDown, onClaim }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const listRef = useRef(null)
  const sorted = useMemo(() => [...items].sort((x, y) =>
    new Date(y.stage_changed_at || y.updated_at || y.created_at || 0) - new Date(x.stage_changed_at || x.updated_at || x.created_at || 0)), [items])
  const visible = sorted.slice(0, visibleCount)
  const isOver = over === stage.id && drag && drag.from !== stage.id

  const onScroll = () => {
    const el = listRef.current
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setVisibleCount(c => Math.min(c + PAGE_SIZE, sorted.length))
  }

  return (
    <div data-stage={stage.id} style={{
      width: CARD_W + 20, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, padding: 10, borderRadius: 20,
      background: isOver ? 'rgba(var(--rgb-19-102-240), 0.07)' : 'rgba(var(--ink-rgb), 0.035)',
      boxShadow: isOver ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.35)' : 'none',
      transition: 'background .15s var(--ease), box-shadow .15s var(--ease)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: stage.color, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{stage.label}</span>
        <span style={{ marginLeft: 2, minWidth: 20, padding: '1px 7px', borderRadius: 99, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', background: 'rgba(var(--ink-rgb), 0.06)' }}>{sorted.length}</span>
      </div>
      <div ref={listRef} onScroll={onScroll} style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 90, maxHeight: 580, overflowY: 'auto', padding: 2 }}>
        {isOver && (   // куда ляжет карточка
          <div style={{ height: drag.h, flexShrink: 0, borderRadius: 16, border: '1.5px dashed rgba(var(--rgb-19-102-240), 0.45)', background: 'rgba(var(--rgb-19-102-240), 0.05)' }} />
        )}
        {visible.map(l => (
          <LeadCard key={l.id} lead={l} users={users} ghost={drag?.id === l.id} onPointerDown={e => onCardDown(e, l)} onClaim={onClaim} />
        ))}
        {visibleCount < sorted.length && (
          <div style={{ textAlign: 'center', padding: 8, fontSize: 11, color: 'var(--text-3)' }}>ещё {sorted.length - visibleCount}, докрутите вниз</div>
        )}
        {!sorted.length && !isOver && <div style={{ textAlign: 'center', padding: '22px 0', fontSize: 11.5, color: 'var(--text-3)' }}>Пусто</div>}
      </div>
    </div>
  )
}

export default function KanbanView({ industry }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [leads, setLeads] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [drag, setDrag] = useState(null)      // { id, from, x, y, ox, oy, w, h } — карточка, которую несут
  const [over, setOver] = useState(null)
  const [activeLead, setActiveLead] = useState(null)
  const [editLead, setEditLead] = useState(null)
  const [saving, setSaving] = useState(false)
  const press = useRef(null)
  const { celebrate } = useCelebration()
  useEscapeKey(() => setActiveLead(null), !!activeLead)

  const loadLeads = (showLoading = true) => {
    if (showLoading) setLoading(true)
    return getLeads({ limit: 3000 }).then(r => setLeads(Array.isArray(r) ? r : (r?.items || []))).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { loadLeads() }, [])
  useEffect(() => {   // имена менеджеров для кружков; нет прав на список — будут «?»
    getAllUsers().then(r => setUsers(Object.fromEntries((r.users || r || []).map(u => [u.id, u.name || u.full_name || u.username])))).catch(() => {})
  }, [])
  useRealtime((event) => { if (event.type === 'lead_updated' && !press.current) loadLeads(false) })

  const filtered = industry ? leads.filter(l => l.industry === industry) : leads
  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map(s => [s.id, []]))
    for (const l of filtered) (m[stageOf(l)] || m.new).push(l)
    return m
  }, [filtered])

  const moveTo = async (leadId, stageId) => {
    const now = new Date().toISOString()
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: stageId, stage_changed_at: now } : l))
    try { await updateLead(leadId, { stage: stageId }) } catch (e) { console.error(e); loadLeads(false) }
  }

  // Перетаскивание на указателе (мышь, тачпад, палец): HTML5 drag-and-drop не работает на телефонах
  // и не даёт «поднятую» карточку. Мышью — после сдвига на 6 px; пальцем — после удержания 0,3 с, иначе это прокрутка.
  const onCardDown = (e, lead) => {
    if (e.button !== undefined && e.button !== 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = { lead, from: stageOf(lead), x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, started: false, touch: e.pointerType === 'touch' }
    press.current = p
    if (p.touch) p.timer = setTimeout(() => start(p, p.x0, p.y0), 300)

    function start(p, x, y) {
      p.started = true
      navigator.vibrate?.(10)
      setDrag({ id: p.lead.id, from: p.from, x, y, ox: p.ox, oy: p.oy, w: p.w, h: p.h })
    }
    const stageAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-stage]')?.dataset.stage || null
    const move = (ev) => {
      const p = press.current
      if (!p) return
      const far = Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > (p.touch ? 8 : 6)
      if (!p.started) {
        if (p.touch) { if (far) cleanup(); return }   // повёл пальцем раньше 0,3 с — это прокрутка
        if (!far) return
        start(p, ev.clientX, ev.clientY)
      }
      setDrag(d => d && { ...d, x: ev.clientX, y: ev.clientY })
      setOver(stageAt(ev.clientX, ev.clientY))
    }
    const block = (ev) => { if (press.current?.started) ev.preventDefault() }   // пока несём пальцем — страница не едет
    const up = (ev) => {
      const p = press.current
      if (p?.started) {
        const to = stageAt(ev.clientX, ev.clientY)
        if (to && to !== p.from) moveTo(p.lead.id, to)
      } else if (p && ev.type === 'pointerup') {
        setActiveLead(p.lead)   // просто нажали — открыть звонок
      }
      cleanup()
    }
    function cleanup() {
      clearTimeout(press.current?.timer)
      press.current = null
      setDrag(null); setOver(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.removeEventListener('touchmove', block)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    document.addEventListener('touchmove', block, { passive: false })
  }

  const handleClaim = async (leadId) => {
    try {
      await claimLead(leadId)
      setLeads(prev => {
        const next = prev.map(l => l.id === leadId ? { ...l, assigned_to: myId } : l)
        setActiveLead(next.find(l => l.id === leadId) || null)   // взял — сразу окно звонка
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

  if (loading) return <Loader padding={40} />

  const draggedLead = drag && leads.find(l => l.id === drag.id)
  const col = (s) => <Column key={s.id} stage={s} items={byStage[s.id]} users={users} drag={drag} over={over} onCardDown={onCardDown} onClaim={handleClaim} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {STAGES.filter(s => s.active).map(col)}
        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(var(--ink-rgb), 0.1)', flexShrink: 0 }} />
        {STAGES.filter(s => !s.active).map(col)}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>Перетаскивайте карточки между колонками · на телефоне — подержите карточку</div>

      {drag && draggedLead && (   // поднятая карточка: чуть повёрнута и с тенью, едет за курсором
        <div style={{ position: 'fixed', left: drag.x - drag.ox, top: drag.y - drag.oy, width: drag.w, zIndex: 1000, pointerEvents: 'none', transform: 'rotate(3deg) scale(1.03)', transformOrigin: `${drag.ox}px ${drag.oy}px` }}>
          <LeadCard lead={draggedLead} users={users} lifted onPointerDown={() => {}} onClaim={() => {}} />
        </div>
      )}

      {activeLead && (
        <CallWindow lead={activeLead} onClose={() => setActiveLead(null)} onClaim={(id) => handleClaim(id)}
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
