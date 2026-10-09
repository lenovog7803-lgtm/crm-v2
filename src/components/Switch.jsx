import { haptic } from '../motion'

// Тумблер как в iOS. Заменяет <input type="checkbox"> один в один: onChange получает
// событие с e.target.checked, поэтому старые обработчики работают без изменений.
export default function Switch({ checked, onChange, disabled, color = '#34C759', size = 'md', title, 'aria-label': ariaLabel }) {
  const toggle = (e) => {
    e.preventDefault()  // внутри <label> — не даём второму клику вернуть состояние
    if (disabled) return
    haptic(8)
    const next = !checked
    onChange?.({ target: { checked: next, value: next }, currentTarget: { checked: next } })
  }
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={ariaLabel} title={title} disabled={disabled}
      onClick={toggle} className={`ios-switch ios-switch--${size}${checked ? ' is-on' : ''}`} style={{ '--switch-on': color }}>
      <span className="ios-switch-knob" />
    </button>
  )
}
