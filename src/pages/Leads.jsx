import { useState, useEffect } from 'react'
import { getIndustries } from '../api'
import QueueView from '../components/leads/QueueView'
import ListView from '../components/leads/ListView'
import KanbanView from '../components/leads/KanbanView'
import AnalyticsView from '../components/leads/AnalyticsView'
import ErrorBoundary from '../components/ErrorBoundary'
import { SlidingTabs } from '../components/SlidingTabs'
import Select from '../components/Select'

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

  useEffect(() => { getIndustries().then(r => setIndustries(r.industries || [])).catch(() => {}) }, [])
  useEffect(() => { localStorage.setItem('leads_view', view) }, [view])
  useEffect(() => { localStorage.setItem('leads_industry', industry) }, [industry])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SlidingTabs options={VIEWS.map(v => ({ key: v.id, label: v.label }))} value={view} onChange={setView} />

        <div style={{ width: 1, height: 24, background: 'rgba(14,23,38,0.1)' }} />

        {industries.length > 0 && (
          <Select value={industry} onChange={e => setIndustry(e.target.value)} className="form-input" style={{ minWidth: 180 }}>
            <option value="">Все отрасли</option>
            {industries.map(i => <option key={i.name} value={i.name}>{i.name} ({i.count})</option>)}
          </Select>
        )}

        {view === 'queue' && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {[['Просрочено', counts.overdue, '#FF3B30'], ['Сегодня', counts.today, '#1366F0'], ['Горячих', counts.hot, '#D97706'], ['Новых', counts.new, '#8A93A0']].map(([t, n, c]) => (
              <span key={t} style={{ padding: '4px 11px', borderRadius: 99, background: `${c}17`, color: c, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {t} <b style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {view === 'queue'     && <ErrorBoundary><QueueView industry={industry} onCounts={setCounts} /></ErrorBoundary>}
      {view === 'list'      && <ErrorBoundary><ListView industry={industry} /></ErrorBoundary>}
      {view === 'kanban'    && <ErrorBoundary><KanbanView industry={industry} /></ErrorBoundary>}
      {view === 'analytics' && <ErrorBoundary><AnalyticsView /></ErrorBoundary>}
    </div>
  )
}
