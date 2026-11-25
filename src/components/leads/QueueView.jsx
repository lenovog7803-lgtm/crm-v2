import { useState, useEffect, useCallback, useRef } from 'react'
import { getCallQueue, getLeadsAnalytics, claimLead } from '../../api'
import { DAILY_GOAL } from '../../constants/leads'
import CallDesk from './CallDesk'
import LeadEditModal from './LeadEditModal'
import { saveCall, SAVE_ERROR } from './saveCall'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { Loader } from '../Loader'
import { CircularProgress } from '../CircularProgress'
import { DailyPriorities } from './GrowthWidgets'

// почему лид в очереди — сервер присылает queue_reason
const REASONS = {
  overdue: ['Просрочен', 'var(--fg-ff3b30)'],
  today: ['На сегодня', 'var(--fg-1366f0)'],
  hot: ['В работе, без даты', 'var(--fg-d97706)'],
  new: ['Новый', 'var(--text-3)'],
}

export default function QueueView({ industry }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [counts, setCounts] = useState({})
  const [todayCalls, setTodayCalls] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [priorityRevision, setPriorityRevision] = useState(0)
  const desk = useRef(null)
  // пройденные за этот заход: обзвоненные и пропущенные — при дозагрузке очереди не показываем их снова
  const passed = useRef({ done: new Set(), skipped: new Set() })
  const { celebrate } = useCelebration()

  const load = useCallback(() => {
    setLoading(true)
    getCallQueue(industry)
      .then(r => {
        const { done, skipped } = passed.current
        setQueue((r.queue || []).filter(l => !done.has(l.id) && !skipped.has(l.id)))
        setIndex(0)
        setCounts(r.counts || { overdue: 0, today: 0, hot: 0, new: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [industry])

  useEffect(() => { load() }, [load])

  // дошли до конца загруженного — спрашиваем сервер, не осталось ли ещё
  useEffect(() => {
    if (!loading && queue.length > 0 && index >= queue.length) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    getLeadsAnalytics('week').then(r => {
      const today = new Date().toISOString().slice(0, 10)
      const row = (r.calls_by_day || []).find(d => d.date === today)
      setTodayCalls(row ? row.calls : 0)
    }).catch(() => {})
  }, [])

  const lead = queue[index]

  const isAvailable = candidate => !passed.current.done.has(candidate.id) && !passed.current.skipped.has(candidate.id)
  const openPriority = selected => {
    const position = queue.findIndex(item => item.id === selected.id)
    if (position >= 0) setIndex(position)
    else {
      const target = Math.min(index, queue.length)
      setQueue(items => [...items.slice(0, target), selected, ...items.slice(target)])
      setIndex(target)
    }
    window.requestAnimationFrame(() => desk.current?.scrollIntoView({ block: 'start' }))
  }

  const skip = () => {
    if (!lead || saving || loading) return
    passed.current.skipped.add(lead.id)
    setSkippedCount(passed.current.skipped.size)
    setIndex(i => i + 1)
  }
  const back = () => { if (!saving && !loading) setIndex(i => Math.max(0, i - 1)) }
  const showSkipped = () => {
    passed.current.skipped.clear()
    setSkippedCount(0)
    load()
  }

  // ← → листают очередь (не во время набора текста и не под открытым окном)
  const nav = useRef({})
  nav.current = { skip, back }
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable], [role=tablist], [role=radiogroup], .lg-segmented')) return
      if (document.querySelector('.ios-alert, .modal-overlay')) return
      if (e.key === 'ArrowRight') nav.current.skip()
      if (e.key === 'ArrowLeft') nav.current.back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSave = async (data) => {
    if (!lead) return
    setSaving(true)
    try {
      await saveCall(lead, data, celebrate)
      passed.current.done.add(lead.id)
      setTodayCalls(c => c + 1)
      setPriorityRevision(r => r + 1)
      setIndex(i => i + 1)
    } catch (e) {
      console.error(e)
      return SAVE_ERROR
    } finally {
      setSaving(false)
    }
  }

  const handleClaim = async () => {
    if (!lead?.id) return
    const claimId = myId || '553e8660-5728-439c-8532-7bb1b2d4ae67'
    try {
      await claimLead(lead.id)
      setQueue(prev => prev.map(l => l.id === lead.id ? { ...l, assigned_to: claimId } : l))
    } catch (e) {
      console.error(e)
    }
  }

  const pct = Math.min(100, Math.round((todayCalls / DAILY_GOAL) * 100))
  const ringColor = pct >= 100 ? 'var(--fg-1e9e5a)' : 'var(--fg-1366f0)'
  const reason = lead && REASONS[lead.queue_reason]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DailyPriorities industry={industry} revision={priorityRevision} isAvailable={isAvailable}
        onOpen={openPriority} disabled={loading || saving} activeId={lead?.id} />
      <header className="order-detail-toolbar lead-queue-bar">
        {!loading && lead && <div className="lead-queue-position">
          <strong>Контакт {index + 1} из {queue.length}</strong>
          {reason && <small>{reason[0]}</small>}
        </div>}
        <details className="queue-day">
          <summary>Сегодня · {todayCalls} из {DAILY_GOAL} звонков</summary>
          <section aria-label="Сводка обзвона" className="leads-summary">
        <div className="leads-goal">
          <CircularProgress pct={pct} color={ringColor} size={38} stroke={4} track="var(--line)" />
          <div><small>Звонки сегодня</small><strong>{todayCalls} <em>из {DAILY_GOAL}</em></strong></div>
        </div>
        <dl>{[['overdue', 'Просрочено'], ['today', 'На сегодня'], ['hot', 'В работе'], ['new', 'Новые']].map(([key, title]) =>
          <div key={key}><dt>{title}</dt><dd className={key === 'overdue' && counts[key] ? 'lead-overdue' : ''}>
            {loading ? '…' : counts[key] >= 500 ? '500+' : counts[key] ?? 0}
          </dd></div>)}</dl>
      </section>
        </details>
        {!loading && lead && <div className="order-detail-actions">
          <button onClick={back} disabled={index === 0 || saving} className="btn-ghost order-detail-back">‹ Назад</button>
          <button onClick={skip} disabled={saving} className="btn-ghost order-detail-edit">Пропустить</button>
        </div>}
      </header>

      {loading && <Loader padding={40} state="searching" label="Загрузка очереди…" />}

      {!loading && !lead && (
        <div className="ios-list" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 20, margin: '0 auto 16px',
            background: 'rgba(var(--rgb-30-158-90), 0.1)', color: 'var(--fg-1e9e5a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          {skippedCount > 0 ? <>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Очередь пройдена</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 16px' }}>Пропущено без звонка: {skippedCount}</div>
            <button onClick={showSkipped} className="btn-primary">Вернуться к пропущенным</button>
          </> : <>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>Очередь пуста</div>
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Все звонки на сегодня обработаны</div>
          </>}
        </div>
      )}

      {!loading && lead && (
        <div ref={desk} className="lead-growth-desk">
          <CallDesk key={lead.id} lead={lead} onEdit={setEditLead} onClaim={handleClaim} onSave={handleSave} saving={saving} />
        </div>
      )}

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => setQueue(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))}
          onDeleted={(id) => setQueue(prev => prev.filter(l => l.id !== id))}
        />
      )}

    </div>
  )
}
