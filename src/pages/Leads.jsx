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
import { ReactivationView } from '../components/leads/GrowthWidgets'
import { useAuth } from '../AuthContext'

const VIEWS = [
  { id: 'queue',     label: 'Очередь' },
  { id: 'list',      label: 'Контакты' },
  { id: 'kanban',    label: 'Стадии' },
  { id: 'reactivation', label: 'Возврат', director: true },
  { id: 'analytics', label: 'Отчёты' },
]

export default function Leads({ initialBatch = '', search = '', onClearSearch }) {
  const { user } = useAuth()
  const director = ['director', 'admin'].includes(user?.user?.role)
  const visibleViews = VIEWS.filter(item => director || !item.director)
  const [savedView, setView] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    return VIEWS.some(v => v.id === requested) ? requested : localStorage.getItem('leads_view') || 'queue'
  })
  const [industry, setIndustry] = useState(() => localStorage.getItem('leads_industry') || '')
  const [batch, setBatch] = useState(initialBatch)
  const [industries, setIndustries] = useState([])
  const [adding, setAdding] = useState(false)
  const [rev, setRev] = useState(0)   // новый лид — виды перечитывают данные

  useEffect(() => { getIndustries().then(r => setIndustries(r.industries || [])).catch(() => {}) }, [])
  useEffect(() => { if (!batch) localStorage.setItem('leads_view', savedView) }, [savedView, batch])
  useEffect(() => { localStorage.setItem('leads_industry', industry) }, [industry])

  const view = search.trim() || batch ? 'list' : visibleViews.some(item => item.id === savedView) ? savedView : 'queue'
  const changeView = next => {
    if (next !== 'list') {
      onClearSearch?.()
      setBatch('')
    }
    setView(next)
  }
  const toggleBatch = () => {
    onClearSearch?.()
    setBatch(batch ? '' : 'latest')
    setView('list')
  }

  const industryFilter = (industries.length > 0 || industry) && (
    <Select fit value={industry} onChange={e => setIndustry(e.target.value)}
      className={`orders-pill${industry ? ' is-on' : ''}`} triggerLabel={industry || 'Отрасль'} aria-label="Отрасль">
      <option value="">Все отрасли</option>
      {industry && !industries.some(i => i.name === industry) && <option value={industry}>{industry}</option>}
      {industries.map(i => <option key={i.name} value={i.name}>{i.name} ({i.count})</option>)}
    </Select>
  )

  return (
    <div className="leads-workspace">
      <div className="leads-navigation">
        <div className="leads-views"><SlidingTabs fill options={visibleViews.map(v => ({ key: v.id, label: v.label }))} value={view} onChange={changeView} /></div>
        <div className="leads-tools orders-filters">
          {(view === 'queue' || view === 'kanban') && industryFilter}
          {(view === 'queue' || view === 'list') && (
            <button type="button" className={`btn-ghost lead-parser-toggle${batch ? ' is-on' : ''}`}
              aria-pressed={Boolean(batch)} onClick={toggleBatch}>
              {batch ? 'Все контакты' : 'Лиды парсера'}
            </button>
          )}
          <button onClick={() => setAdding(true)} className="btn-primary">Новый лид</button>
        </div>
      </div>

      {view === 'queue'     && <ErrorBoundary><QueueView key={rev} industry={industry} /></ErrorBoundary>}
      {view === 'list'      && <ErrorBoundary><ListView key={rev} industry={industry} industryFilter={industryFilter} search={search} batch={batch} /></ErrorBoundary>}
      {view === 'kanban'    && <ErrorBoundary><KanbanView key={rev} industry={industry} /></ErrorBoundary>}
      {view === 'reactivation' && <ErrorBoundary><ReactivationView /></ErrorBoundary>}
      {view === 'analytics' && <ErrorBoundary><AnalyticsView director={director} /></ErrorBoundary>}

      {adding && <LeadEditModal lead={{}} onClose={() => setAdding(false)} onSaved={() => setRev(r => r + 1)} />}
    </div>
  )
}
