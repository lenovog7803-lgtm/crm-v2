import { useState, useEffect, useCallback } from 'react'
import { getCallQueue, logCall, convertLead, getLeadsAnalytics, claimLead } from '../../api'
import { DAILY_GOAL } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'
import { Loader } from '../Loader'
import { CircularProgress } from '../CircularProgress'
import { iosConfirm } from '../IOSAlert'

export default function QueueView({ industry, onCounts }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [todayCalls, setTodayCalls] = useState(0)
  const { celebrate } = useCelebration()

  const load = useCallback(() => {
    setLoading(true)
    getCallQueue(industry)
      .then(r => {
        setQueue(r.queue || [])
        setIndex(0)
        onCounts?.(r.counts || { overdue: 0, today: 0, hot: 0, new: 0 })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [industry, onCounts])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getLeadsAnalytics('week').then(r => {
      const today = new Date().toISOString().slice(0, 10)
      const row = (r.calls_by_day || []).find(d => d.date === today)
      setTodayCalls(row ? row.calls : 0)
    }).catch(() => {})
  }, [])

  const lead = queue[index]

  const advance = () => setIndex(i => i + 1)

  const handleSave = async (data) => {
    if (!lead) return
    setSaving(true)
    try {
      const res = await logCall(lead.id, data)
      setTodayCalls(c => c + 1)
      if (data.outcome === 'won') celebrate()
      if (res.ask_create_client && await iosConfirm(`Создать карточку клиента? ${lead.name} стал клиентом — перенести в раздел «Клиенты»?`, { cancelLabel: 'Нет' })) {
        try { await convertLead(lead.id) } catch (e) { console.error(e) }
      }
      advance()
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const handleClaim = async () => {
    if (!lead) return
    try {
      await claimLead(lead.id)
      setQueue(prev => prev.map(l => l.id === lead.id ? { ...l, assigned_to: myId } : l))
    } catch (e) {
      console.error(e)
    }
  }

  const pct = Math.min(100, Math.round((todayCalls / DAILY_GOAL) * 100))
  const ringColor = pct >= 100 ? 'var(--fg-1e9e5a)' : 'var(--fg-1366f0)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '12px 16px 12px 14px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <CircularProgress pct={pct} color={ringColor} size={40} stroke={5} track="rgba(var(--ink-rgb), 0.08)" />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          <b style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{todayCalls}</b> из {DAILY_GOAL} звонков сегодня
        </div>
        {!loading && lead && <>
          <div style={{ width: 1, height: 22, background: 'rgba(var(--ink-rgb), 0.1)' }} />
          <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{index + 1} из {queue.length} в очереди</span>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {!lead.assigned_to && (
              <button onClick={handleClaim} className="btn-primary">Взять в работу</button>
            )}
            <button onClick={advance} className="btn-ghost">Пропустить</button>
          </div>
        </>}
      </div>

      {loading && <Loader padding={40} state="searching" label="Загрузка очереди…" />}

      {!loading && !lead && (
        <div className="ios-list" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 16px',
            background: 'rgba(var(--rgb-30-158-90), 0.1)', color: 'var(--fg-1e9e5a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Очередь пуста</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6 }}>Все звонки на сегодня обработаны</div>
        </div>
      )}

      {!loading && lead && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
            <CallCard lead={lead} onEdit={setEditLead} />
            <ScriptPanel stage={lead.stage} />
          </div>

          <CallOutcomeBar lead={lead} onSave={handleSave} saving={saving} />
        </>
      )}

      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => setQueue(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l))}
        />
      )}

    </div>
  )
}
