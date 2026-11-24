import { Switch as GlassSwitch } from 'glisse'
import { haptic, prefersReducedMotion } from '../motion'

// Тумблер как в iOS. Заменяет <input type="checkbox"> один в один: onChange получает
// событие с e.target.checked, поэтому старые обработчики работают без изменений.
export default function Switch({ checked, onChange, disabled, color = 'var(--bg-1366f0)', size = 'md', title, 'aria-label': ariaLabel }) {
  const change = next => {
    haptic(8)
    onChange?.({ target: { checked: next, value: next }, currentTarget: { checked: next } })
  }
  if (!prefersReducedMotion()) return (
    <GlassSwitch type="button" checked={!!checked} onCheckedChange={change}
      disabled={disabled} aria-label={ariaLabel} title={title} className="crm-glass-switch"
      style={{ '--lg-on': color }} />
  )

  const toggle = event => {
    event.preventDefault()
    if (!disabled) change(!checked)
  }
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={ariaLabel} title={title} disabled={disabled}
      onClick={toggle} className={`ios-switch ios-switch--${size}${checked ? ' is-on' : ''}`} style={{ '--switch-on': color }}>
      <span className="ios-switch-knob" />
    </button>
  )
}
