import { useState, useEffect, useCallback, useRef } from 'react'
import { getCallQueue, getLeadsAnalytics, claimLead } from '../../api'
import { DAILY_GOAL } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { saveCall, SAVE_ERROR } from './saveCall'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Loader } from '../Loader'
import { CircularProgress } from '../CircularProgress'

// почему лид в очереди — сервер присылает queue_reason
const REASONS = {
  overdue: ['Просрочен', 'var(--fg-ff3b30)'],
  today: ['На сегодня', 'var(--fg-1366f0)'],
  hot: ['В работе, без даты', 'var(--fg-d97706)'],
  new: ['Новый', 'var(--text-3)'],
}

export default function QueueView({ industry, onCounts }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const isMobile = useIsMobile()
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [todayCalls, setTodayCalls] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
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
        onCounts?.(r.counts || { overdue: 0, today: 0, hot: 0, new: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [industry, onCounts])

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
  const next = queue[index + 1]

  const skip = () => {
    if (!lead) return
    passed.current.skipped.add(lead.id)
    setSkippedCount(passed.current.skipped.size)
    setIndex(i => i + 1)
  }
  const back = () => setIndex(i => Math.max(0, i - 1))
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
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return
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
      <div className="card leads-queue-toolbar">
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircularProgress pct={pct} color={ringColor} size={40} stroke={5} track="rgba(var(--ink-rgb), 0.08)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          <b style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{todayCalls}</b> из {DAILY_GOAL} звонков сегодня
        </div>
        {!loading && lead && <>
          <span className="leads-queue-position">{index + 1} из {queue.length} в очереди</span>
          {reason && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: reason[1] }} />{reason[0]}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', minWidth: 0 }}>
            {next && !isMobile && (
              <span style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Дальше: {next.name}</span>
            )}
            {!lead.assigned_to ? (
              <button onClick={handleClaim} className="call-pill call-pill--blue">Взять в работу</button>
            ) : lead.assigned_to === myId ? (
              <span className="call-pill call-pill--green">В вашей работе</span>
            ) : (
              <span className="call-pill">В работе</span>
            )}
            <button onClick={back} disabled={index === 0} className="btn-ghost" title="Предыдущий (←)" style={{ opacity: index === 0 ? 0.45 : 1 }}>Назад</button>
            <button onClick={skip} className="btn-ghost" title="Пропустить (→)">Пропустить</button>
          </div>
        </>}
      </div>

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
        <>
          {/* то же расположение, что в окне звонка из Списка и Канбана: кто это → скрипт и результат рядом → история */}
          <CallCard lead={lead} onEdit={setEditLead} onClaim={handleClaim} part="header" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr', gap: 16, alignItems: 'start' }}>
            <ScriptPanel stage={lead.stage} lead={lead} />
            <CallOutcomeBar lead={lead} onSave={handleSave} saving={saving} columns={2} />
          </div>
          <CallCard lead={lead} onEdit={setEditLead} onClaim={handleClaim} part="history" />
        </>
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
