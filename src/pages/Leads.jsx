import { useState, useEffect } from 'react'
import { getIndustries } from '../api'
import QueueView from '../components/leads/QueueView'
import ListView from '../components/leads/ListView'
import KanbanView from '../components/leads/KanbanView'
import AnalyticsView from '../components/leads/AnalyticsView'
import ErrorBoundary from '../components/ErrorBoundary'
import { SlidingTabs } from '../components/SlidingTabs'

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
          <select value={industry} onChange={e => setIndustry(e.target.value)} className="form-input" style={{ minWidth: 180 }}>
            <option value="">Все отрасли</option>
            {industries.map(i => <option key={i.name} value={i.name}>{i.name} ({i.count})</option>)}
          </select>
        )}

        {view === 'queue' && (
          <div style={{ display: 'flex', gap: 14, marginLeft: 'auto', fontSize: 12.5 }}>
            <span style={{ color: '#E0473B', fontWeight: 600 }}>Просрочено {counts.overdue}</span>
            <span style={{ color: '#1366F0', fontWeight: 600 }}>Сегодня {counts.today}</span>
            <span style={{ color: '#D97706', fontWeight: 600 }}>Горячих {counts.hot}</span>
            <span style={{ color: '#8A93A0', fontWeight: 600 }}>Новых {counts.new}</span>
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
