import { useState, useEffect, useCallback } from 'react'
import { getCallQueue, logCall, convertLead, getLeadsAnalytics, claimLead } from '../../api'
import { DAILY_GOAL } from '../../constants/leads'
import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import ScriptPanel from './ScriptPanel'
import LeadEditModal from './LeadEditModal'
import { useCelebration } from '../Celebration'
import { useAuth } from '../../AuthContext'

export default function QueueView({ industry, onCounts }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editLead, setEditLead] = useState(null)
  const [askClient, setAskClient] = useState(null)
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
      if (res.ask_create_client) {
        setAskClient(lead)
      } else {
        advance()
      }
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  const handleConvert = async (yes) => {
    if (yes && askClient) {
      try { await convertLead(askClient.id) } catch (e) { console.error(e) }
    }
    setAskClient(null)
    advance()
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(19,102,240,0.08)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: '#A6AEB8', marginBottom: 4 }}>ЗВОНКИ СЕГОДНЯ</div>
            <span style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: '#0E1726' }}>{todayCalls}</span>
            <span style={{ fontSize: 14, color: '#A6AEB8' }}> / {DAILY_GOAL}</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: pct >= 100 ? '#1E9E5A' : '#1366F0' }}>{pct}%</span>
        </div>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'rgba(14,23,38,0.07)' }}>
          <div style={{ height: '100%', borderRadius: 99, background: pct >= 100 ? '#1E9E5A' : '#1366F0', width: `${pct}%`, transition: 'width 0.4s var(--ease)' }} />
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка очереди…</div>}

      {!loading && !lead && (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 16px',
            background: 'rgba(30,158,90,0.1)', color: '#1E9E5A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 16, color: '#0E1726' }}>Очередь пуста</div>
          <div style={{ fontSize: 13, color: '#A6AEB8', marginTop: 6 }}>Все звонки на сегодня обработаны</div>
        </div>
      )}

      {!loading && lead && (
        <>
          <div className="card" style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#5A6573' }}>{index + 1} из {queue.length} в очереди</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {!lead.assigned_to && (
                <button onClick={handleClaim} className="btn-primary" style={{ padding: '8px 14px', fontSize: 12.5 }}>Взять в работу</button>
              )}
              <button onClick={advance} className="btn-ghost">Пропустить →</button>
            </div>
          </div>

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

      {askClient && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(14,23,38,0.55)',
          backdropFilter: 'blur(6px)',
          zIndex: 1100,
          overflowY: 'auto',
          display: 'grid',
          padding: 20,
        }}>
          <div style={{
            margin: 'auto',
            background: '#FFFFFF',
            borderRadius: 24,
            width: '100%', maxWidth: 380,
            textAlign: 'center',
            border: '1px solid rgba(14,23,38,0.08)',
            boxShadow: '0 40px 80px rgba(20,30,55,0.28)',
          }}>
            <div style={{ padding: 26 }}>
              <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 16, color: '#0E1726', marginBottom: 8 }}>Создать карточку клиента?</div>
              <div style={{ fontSize: 13, color: '#5A6573', marginBottom: 20 }}>{askClient?.name} стал клиентом — перенести в раздел «Клиенты»?</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => handleConvert(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Нет</button>
                <button onClick={() => handleConvert(true)} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Да</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
