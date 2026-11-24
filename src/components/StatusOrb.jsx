import { statusColor } from '../utils'

export function StatusOrb({ status, overdue = false, scale = 1 }) {
  return <span className="activity-status-dot" aria-hidden={overdue ? undefined : true}
    aria-label={overdue ? 'Просрочено' : undefined}
    style={{ color: overdue ? 'var(--fg-c81923)' : statusColor(status), width: 10 * scale, height: 10 * scale }} />
}
