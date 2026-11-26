import { useState, useEffect, useRef } from 'react'
import { getLeads } from '../../api'
import { STAGES, stageById, stageOf } from '../../constants/leads'
import LeadEditModal from './LeadEditModal'
import { claimLead } from '../../api'
import { saveCall, SAVE_ERROR } from './saveCall'
import { SkeletonList } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import CallWindow from './CallWindow'
import Select from '../Select'
import { fmtDate, leadLegalName } from '../../utils'

const FILTERS_KEY = 'leads_list_filters'
const PAGE = 40

function loadFilters() {
  try {
    const { stage = '', overdueOnly = false } = JSON.parse(localStorage.getItem(FILTERS_KEY)) || {}
    return { stage, overdueOnly }
  } catch {
    return { stage: '', overdueOnly: false }
  }
}

export default function ListView({ industry, industryFilter, search, batch }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [filters, setFilters] = useState(loadFilters)
  const [activeLead, setActiveLead] = useState(null)
  const [editLead, setEditLead] = useState(null)
  useEscapeKey(() => setActiveLead(null), !!activeLead && !editLead)   // Esc закрывает верхнее окно, а не оба
  const [saving, setSaving] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const scrollRef = useRef(null)
  const { celebrate } = useCelebration()

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError(false)
    getLeads(batch ? { batch } : { limit: 3000 })
      .then(r => { if (current) setLeads(Array.isArray(r) ? r : (r?.items || [])) })
      .catch(() => { if (current) setLoadError(true) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [batch, retry])

  useEffect(() => { localStorage.setItem(FILTERS_KEY, JSON.stringify(filters)) }, [filters])

  const set = (k) => (v) => setFilters(p => ({ ...p, [k]: v }))

  const now = new Date().toISOString()
  const query = search.trim().toLowerCase()
  const filtered = leads.filter(l => {
    if (!batch) {
      if (industry && l.industry !== industry) return false
      if (filters.stage && stageOf(l) !== filters.stage) return false
      if (filters.overdueOnly && !(l.next_call && l.next_call < now)) return false
    }
    if (query) {
      const hit = [l.name, l.company, l.legal_name, l.phone, l.email, l.website, l.contact_person, l.industry].filter(Boolean).some(v => v.toLowerCase().includes(query))
      if (!hit) return false
    }
    return true
  })

  useEffect(() => { setVisibleCount(PAGE) }, [filters, industry, query, batch])

  const visible = filtered.slice(0, visibleCount)
  const batchDate = batch === 'latest' ? leads[0]?.codex_batch : batch

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setVisibleCount(prev => Math.min(prev + PAGE, filtered.length))
    }
  }

  const handleSave = async (data) => {
    if (!activeLead) return
    setSaving(true)
    try {
      const res = await saveCall(activeLead, data, celebrate)
      setLeads(prev => prev.map(l => l.id === activeLead.id ? res.lead : l))
      setActiveLead(null)
    } catch (e) {
      console.error(e)
      return SAVE_ERROR
    } finally {
      setSaving(false)
    }
  }

  const handleClaim = async (leadId, e) => {
    e?.stopPropagation()
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
    <>
      <section className="card lead-directory" aria-label="Контакты базы обзвона">
      <div className="lead-directory-tools">
        <div className="lead-directory-count" aria-live="polite">
          <strong>{batch ? (batchDate ? `Выпуск ${fmtDate(batchDate)}` : 'Лиды парсера') : 'Лиды'}</strong>
          {!loading && !loadError && <span>{batch ? `Карточек: ${filtered.length}` : filtered.length === leads.length ? leads.length : `${filtered.length} из ${leads.length}`}</span>}
        </div>
        {!batch && <div className="orders-filters" aria-label="Фильтры лидов">
          {industryFilter}
          <Select fit value={filters.stage} onChange={e => set('stage')(e.target.value)}
            className={`orders-pill${filters.stage ? ' is-on' : ''}`} triggerLabel={filters.stage ? stageById(filters.stage).label : 'Стадия'}>
            <option value="">Все стадии</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <button type="button" className={`orders-pill-btn orders-pill lead-overdue-filter${filters.overdueOnly ? ' is-on' : ''}`}
            aria-pressed={filters.overdueOnly} onClick={() => set('overdueOnly')(!filters.overdueOnly)}>Просроченные</button>
        </div>}
      </div>

      {loading && (
        <SkeletonList />
      )}

      {!loading && loadError && (
        <div className="lead-directory-results">
          <EmptyState title="Не удалось загрузить контакты" actionLabel="Повторить" onAction={() => setRetry(n => n + 1)} />
        </div>
      )}
      {!loading && !loadError && filtered.length === 0 && (
        <div className="lead-directory-results">
          <EmptyState title={batch ? 'В выпуске нет подходящих лидов' : 'Нет лидов по фильтрам'}
            subtitle={batch ? undefined : 'Попробуйте изменить стадию или поисковый запрос'} />
        </div>
      )}

      {!loading && !loadError && filtered.length > 0 && (
        <div className="lead-directory-results">
          <div className="lead-directory-columns" aria-hidden="true">
            <span>Компания</span><span>Контакт</span><span>Стадия</span><span>Звонок</span>
          </div>
          <div ref={scrollRef} onScroll={handleScroll} style={{ maxHeight: 640, overflowY: 'auto' }}>
            {visible.map(l => {
              const st = stageById(l.stage)
              const overdue = l.next_call && l.next_call < now
              const contact = l.phone || l.email
              const name = leadLegalName(l) || l.name
              const sub = [l.contact_person, l.city, batch ? l.industry : ''].filter(Boolean).join(' · ')
              return (
                <div key={l.id} className="ios-row lead-directory-row" onClick={() => setActiveLead(l)}>
                  <div className="ios-row-text">
                    <button className="lead-name" title={name} onClick={e => { e.stopPropagation(); setActiveLead(l) }}>{name}</button>
                    {sub && <div className="ios-row-sub lead-desktop-meta">{sub}</div>}
                    <div className="ios-row-sub lead-compact-meta">{[st.label, contact, sub].filter(Boolean).join(' · ')}</div>
                  </div>
                  <span className="lead-directory-phone" title={contact || undefined}>{contact}</span>
                  <span className="lead-directory-stage">{st.label}</span>
                  {l.next_call && <time dateTime={l.next_call} className={overdue ? 'lead-due is-late' : 'lead-due'}
                    title={overdue ? 'Звонок просрочен' : 'Следующий звонок'}>
                    {new Date(l.next_call).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(new Date(l.next_call).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })}
                  </time>}
                </div>
              )
            })}
            {visibleCount < filtered.length && (
              <div style={{ textAlign: 'center', padding: 14, fontSize: 12, color: 'var(--text-3)' }}>
                показано {visible.length} из {filtered.length} · докрутите вниз
              </div>
            )}
          </div>
        </div>
      )}

      </section>

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
          onDeleted={(id) => { setLeads(prev => prev.filter(l => l.id !== id)); setActiveLead(null) }}
        />
      )}
    </>
  )
}
