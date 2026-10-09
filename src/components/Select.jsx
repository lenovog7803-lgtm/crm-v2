import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../hooks/useIsMobile'

// Выпадающий список в стиле macOS. Заменяет <select> один в один: тот же value / onChange(e)
// (e.target.value — строка, как у родного), те же <option> внутри.
// Компьютер — своё стеклянное меню с галочкой; телефон — родной список iOS (колесо), только оформленный.

const textOf = (node) => Children.toArray(node).map(n => (typeof n === 'string' || typeof n === 'number') ? String(n) : (isValidElement(n) ? textOf(n.props.children) : '')).join('')

function collectOptions(children, out = []) {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return
    if (ch.type === 'option') {
      const label = textOf(ch.props.children)
      const value = ch.props.value !== undefined ? String(ch.props.value) : label
      out.push({ value, label, disabled: !!ch.props.disabled, separator: !!ch.props.disabled && /^[─—\-\s]+$/.test(label) })
    } else if (ch.props?.children) {
      collectOptions(ch.props.children, out)  // фрагменты и группы
    }
  })
  return out
}

const Chevrons = () => (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.6 }}>
    <polyline points="2 5 5 2 8 5" /><polyline points="2 9 5 12 8 9" />
  </svg>
)

export default function Select({ value, onChange, onBlur, children, style, className = '', disabled, ...rest }) {
  const isMobile = useIsMobile()
  const options = collectOptions(children)
  const current = options.find(o => o.value === String(value ?? '')) || options.find(o => !o.disabled) || { label: '' }
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)
  const typed = useRef({ s: '', t: 0 })

  const fire = (v) => {
    const e = { target: { value: v, name: rest.name }, currentTarget: { value: v } }
    onChange?.(e)
  }

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const want = Math.min(320, options.length * 32 + 12)
    const below = window.innerHeight - r.bottom - 12
    const up = below < Math.min(want, 200) && r.top > below
    setPos({ left: r.left, width: Math.max(r.width, 180), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxH: Math.max(140, Math.min(320, up ? r.top - 12 : below)), origin: up ? 'bottom' : 'top' })
  }

  const openMenu = () => {
    if (disabled) return
    place()
    setActive(options.findIndex(o => o.value === current.value))
    setOpen(true)
  }
  const close = () => { setOpen(false); btnRef.current?.focus() }
  const choose = (o) => { if (!o || o.disabled) return; if (o.value !== String(value ?? '')) fire(o.value); close() }

  useLayoutEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  useEffect(() => {
    if (!open) return
    const outside = (e) => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    const away = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => { document.removeEventListener('mousedown', outside); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away) }
  }, [open])

  const step = (dir) => {
    let i = active
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length
      if (!options[i].disabled) break
    }
    setActive(i)
  }

  const onKeyDown = (e) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); step(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[active]) }
    else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close() }
    else if (e.key.length === 1) {
      // поиск по первым буквам, как в меню macOS
      const now = Date.now()
      typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : '') + e.key.toLowerCase(), t: now }
      const i = options.findIndex(o => !o.disabled && o.label.toLowerCase().startsWith(typed.current.s))
      if (i >= 0) setActive(i)
    }
  }

  // Телефон: родной список iOS/Android — лучшее, что есть на тач-экране
  if (isMobile) {
    return (
      <select value={value} onChange={onChange} onBlur={onBlur} disabled={disabled} className={`apple-select-native ${className}`} style={style} {...rest}>
        {children}
      </select>
    )
  }

  return (
    <>
      <button type="button" ref={btnRef} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? close() : openMenu())} onKeyDown={onKeyDown} onBlur={onBlur}
        className={`apple-select ${className}${open ? ' is-open' : ''}`} style={style} title={current.label}>
        <span className="apple-select-label">{current.label}</span>
        <Chevrons />
      </button>
      {open && pos && createPortal(
        <div ref={menuRef} role="listbox" className="apple-select-menu" onKeyDown={onKeyDown}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxH, transformOrigin: `${pos.origin} left` }}>
          {options.map((o, i) => o.separator
            ? <div key={'sep' + i} className="apple-select-sep" />
            : (
              <div key={o.value + i} role="option" aria-selected={o.value === current.value} aria-disabled={o.disabled}
                data-active={i === active} className={`apple-select-item${o.disabled ? ' is-disabled' : ''}`}
                onMouseMove={() => !o.disabled && setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o)}>
                <span className="apple-select-check">{o.value === current.value ? '✓' : ''}</span>
                <span>{o.label}</span>
              </div>
            ))}
        </div>,
        document.body,
      )}
    </>
  )
}
