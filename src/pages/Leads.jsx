import { useState, useEffect } from 'react'
import { getIndustries } from '../api'
import QueueView from '../components/leads/QueueView'
import ListView from '../components/leads/ListView'
import KanbanView from '../components/leads/KanbanView'
import AnalyticsView from '../components/leads/AnalyticsView'
import ErrorBoundary from '../components/ErrorBoundary'
import { SlidingTabs } from '../components/SlidingTabs'
import Select from '../components/Select'
import LeadEditModal from '../components/leads/LeadEditModal'

const VIEWS = [
  { id: 'queue',     label: 'Очередь' },
  { id: 'list',      label: 'Список' },
  { id: 'kanban',    label: 'Канбан' },
  { id: 'analytics', label: 'Отчёты' },
]

export default function Leads() {
  const [view, setView] = useState(() => localStorage.getItem('leads_view') || 'queue')
  const [industry, setIndustry] = useState(() => localStorage.getItem('leads_industry') || '')
  const [industries, setIndustries] = useState([])
  const [counts, setCounts] = useState({ overdue: 0, today: 0, hot: 0, new: 0 })
  const [adding, setAdding] = useState(false)
  const [rev, setRev] = useState(0)   // новый лид — виды перечитывают данные

  useEffect(() => { getIndustries().then(r => setIndustries(r.industries || [])).catch(() => {}) }, [])
  useEffect(() => { localStorage.setItem('leads_view', view) }, [view])
  useEffect(() => { localStorage.setItem('leads_industry', industry) }, [industry])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SlidingTabs options={VIEWS.map(v => ({ key: v.id, label: v.label }))} value={view} onChange={setView} />

        <div style={{ width: 1, height: 24, background: 'rgba(var(--ink-rgb), 0.1)' }} />

        {industries.length > 0 && (
          <Select value={industry} onChange={e => setIndustry(e.target.value)} className="form-input" style={{ minWidth: 180 }}>
            <option value="">Все отрасли</option>
            {industries.map(i => <option key={i.name} value={i.name}>{i.name} ({i.count})</option>)}
          </Select>
        )}

        <button onClick={() => setAdding(true)} className="btn-ghost">Новый лид</button>

        {view === 'queue' && (
          <div style={{ display: 'flex', gap: 18, marginLeft: 'auto', flexWrap: 'wrap', paddingRight: 4 }}>
            {[['Просрочено', counts.overdue, 'var(--fg-ff3b30)'], ['Сегодня', counts.today, 'var(--fg-1366f0)'], ['Горячих', counts.hot, 'var(--fg-d97706)'], ['Новых', counts.new, 'var(--text-3)']].map(([t, n, c]) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: c, opacity: n ? 1 : 0.35 }} />
                {t} <b style={{ color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n >= 500 ? '500+' : n}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {view === 'queue'     && <ErrorBoundary><QueueView key={rev} industry={industry} onCounts={setCounts} /></ErrorBoundary>}
      {view === 'list'      && <ErrorBoundary><ListView key={rev} industry={industry} /></ErrorBoundary>}
      {view === 'kanban'    && <ErrorBoundary><KanbanView key={rev} industry={industry} /></ErrorBoundary>}
      {view === 'analytics' && <ErrorBoundary><AnalyticsView /></ErrorBoundary>}

      {adding && <LeadEditModal lead={{}} onClose={() => setAdding(false)} onSaved={() => setRev(r => r + 1)} />}
    </div>
  )
}
