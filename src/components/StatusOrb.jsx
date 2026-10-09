import { ThinkingOrb } from 'thinking-orbs'
import { statusColor } from '../utils'

// Живой статус заявки: «В пути» — точки бегут по орбите, «Новая» — спокойное дыхание,
// «Доставлено» и «Отменено» — замершая сфера. Просроченная — красная и быстрее.
const LIVE = { in_progress: 'working', active: 'working', new: 'breathing' }

export function StatusOrb({ status, overdue = false, scale = 1 }) {
  const live = LIVE[status]
  const color = overdue ? '#C81923' : statusColor(status)
  return (
    <span style={{ display: 'inline-flex', width: 20 * scale, height: 20 * scale, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
      {/* замершие статусы — точечный «глобус»: в покое он читается как ровная сфера */}
      <ThinkingOrb state={live || 'searching'} size={20} color={color} dotSize={1.4}
        paused={!live} speed={overdue ? 1.5 : 1}
        style={scale !== 1 ? { transform: `scale(${scale})` } : undefined}
        aria-label={overdue ? 'Просрочено' : undefined} />
    </span>
  )
}
