import { SuccessCheck } from './Transitions'
import { haptic } from '../motion'

// Круглая отметка как в «Напоминаниях» iOS 26. Заменяет <input type="checkbox">:
// onChange получает e.target.checked, как раньше.
export default function CheckCircle({ checked, onChange, color = '#0A84FF', size = 18 }) {
  return (
    <button type="button" role="checkbox" aria-checked={!!checked}
      onClick={e => { e.preventDefault(); haptic(8); onChange?.({ target: { checked: !checked } }) }}
      className={`ios-check${checked ? ' is-on' : ''}`} style={{ '--check-on': color, width: size, height: size }}>
      <SuccessCheck show={!!checked} size={Math.round(size * 0.55)} strokeWidth={3.4} />
    </button>
  )
}
