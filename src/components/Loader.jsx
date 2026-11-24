export function ActivityIndicator({ compact = false }) {
  const route = 'M11 30 Q24 10 38 19'
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className={compact ? 'activity-route activity-route--small' : 'activity-route'}>
      <circle cx="24" cy="24" r="21" fill="currentColor" fillOpacity=".07" stroke="currentColor" strokeOpacity=".44" />
      <g fill="none" stroke="currentColor" opacity=".18" strokeWidth=".8">
        <ellipse cx="24" cy="24" rx="11" ry="21" />
        <ellipse cx="24" cy="24" rx="21" ry="7" />
        <path d="M24 3v42" />
      </g>
      <g fill="currentColor" opacity=".32">
        <path d="m6 16 5-6 6-3 5 2-2 4-4 1-1 5-4 1 1 4-3-2zM12 24l7 1 3 4-3 5-2 6-3-4 1-5z" />
        <path d="m26 13 3-5 4 2 2-1 6 6 1 4-5-1-3 4-2-4-5 1-2-3zM26 21l6-1 4 4-3 7-4 3-2-5-3-4zM36 33l4-2 1 4-5 2z" />
      </g>
      <path d={route} fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".48" />
      <path d={route} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" pathLength="100" className="activity-route-pulse" />
      <circle className="activity-waypoint" cx="38" cy="19" r="3" fill="none" stroke="currentColor" />
      <g fill="currentColor"><circle cx="11" cy="30" r="2" /><circle cx="38" cy="19" r="2" /></g>
    </svg>
  )
}

export function Loader({ label = 'Загрузка…', padding = 40, style }) {
  return (
    <div role="status" className="activity-loading" style={{ padding, ...style }}>
      <ActivityIndicator />
      {label && <span>{label}</span>}
    </div>
  )
}

export function InlineLoader({ label = 'Загрузка…' }) {
  return (
    <span role="status" className="activity-inline">
      <ActivityIndicator compact />
      {label}
    </span>
  )
}
