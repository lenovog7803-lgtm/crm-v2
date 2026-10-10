import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { haptic, prefersReducedMotion } from '../motion'

// Календарь в стиле iOS 26. Заменяет <input type="date"> и <input type="datetime-local"> один в один:
// value — ISO-строка ('2026-10-09' или '2026-10-09T14:30'), onChange(e) получает e.target.value.
// Телефон — родной выбор даты iOS/Android (он и так «как в iOS»).

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const pad = n => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`

const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, opacity: 0.55 }}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="3.5" /><line x1="3" y1="9.5" x2="21" y2="9.5" /><line x1="8" y1="2.5" x2="8" y2="6" /><line x1="16" y1="2.5" x2="16" y2="6" />
  </svg>
)
const Chev = ({ dir }) => (
  <svg width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points={dir < 0 ? '7 1.5 1.5 7.5 7 13.5' : '2 1.5 7.5 7.5 2 13.5'} />
  </svg>
)

export default function DateInput({ type = 'date', value, onChange, disabled, style, className = '', placeholder, ...rest }) {
  const isMobile = useIsMobile()
  const withTime = type === 'datetime-local'
  const datePart = (value || '').slice(0, 10)
  const timePart = withTime ? (value || '').slice(11, 16) : ''
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [view, setView] = useState({ y: 0, m: 0 })
  const closeT = useRef(0)

  const fire = v => onChange?.({ target: { value: v, name: rest.name }, currentTarget: { value: v } })

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    const H = withTime ? 400 : 356, W = 300
    const up = window.innerHeight - r.bottom < H + 12 && r.top > window.innerHeight - r.bottom
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    // календарь вырастает из поля: точка роста — середина поля
    setPos({ left, ox: Math.min(W, Math.max(0, r.left + r.width / 2 - left)), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, origin: up ? 'bottom' : 'top' })
  }
  const openPop = () => {
    if (disabled) return
    const d = valid ? new Date(datePart + 'T00:00') : new Date()
    setView({ y: d.getFullYear(), m: d.getMonth() })
    clearTimeout(closeT.current)
    popRef.current?.classList.remove('is-closing')
    place()
    setOpen(true)
  }
  // закрытие — обратно в поле тем же путём
  const hide = () => {
    const p = popRef.current
    if (!p || prefersReducedMotion()) return setOpen(false)
    p.classList.add('is-closing')
    clearTimeout(closeT.current)
    closeT.current = setTimeout(() => setOpen(false), 130)
  }
  useEffect(() => () => clearTimeout(closeT.current), [])
  const close = () => { hide(); btnRef.current?.focus() }

  useEffect(() => {
    if (!open) return
    const outside = e => { if (!popRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) hide() }
    // прокрутка формы не закрывает календарь — он едет вместе с полем
    const away = e => { if (!popRef.current?.contains(e.target)) place() }
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', key, true)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', key, true); window.removeEventListener('scroll', away, true); window.removeEventListener('resize', away) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (isMobile) {
    return <input type={type} value={value || ''} onChange={onChange} disabled={disabled} className={className} style={style} {...rest} />
  }

  const pick = (d) => {
    haptic(6)
    fire(withTime ? `${d}T${timePart || '09:00'}` : d)
    if (!withTime) close()
  }
  const shift = n => setView(v => { const t = new Date(v.y, v.m + n, 1); return { y: t.getFullYear(), m: t.getMonth() } })

  const today = new Date()
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate())
  const first = (new Date(view.y, view.m, 1).getDay() + 6) % 7  // понедельник — первый
  const days = new Date(view.y, view.m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  const label = valid
    ? new Date(datePart + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }).replace(' г.', '') + (withTime && timePart ? `, ${timePart}` : '')
    : (placeholder || 'Выбрать дату')

  return (
    <>
      <button type="button" ref={btnRef} disabled={disabled} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => (open ? close() : openPop())}
        className={`apple-select date-input ${className}${open ? ' is-open' : ''}`} style={style} title={rest.title}>
        <span className="apple-select-label" style={{ color: valid ? undefined : 'rgba(60,60,67,0.45)' }}>{label}</span>
        <CalIcon />
      </button>
      {open && pos && createPortal(
        <div ref={popRef} role="dialog" aria-label="Календарь" className="ios-cal"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, transformOrigin: `${pos.ox}px ${pos.origin}` }}>
          <div className="ios-cal-head">
            <div className="ios-cal-title">{MONTHS[view.m]} {view.y}</div>
            <button type="button" className="ios-cal-nav" onClick={() => shift(-1)} aria-label="Предыдущий месяц"><Chev dir={-1} /></button>
            <button type="button" className="ios-cal-nav" onClick={() => shift(1)} aria-label="Следующий месяц"><Chev dir={1} /></button>
          </div>
          <div className="ios-cal-grid">
            {WEEK.map(w => <div key={w} className="ios-cal-wd">{w}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={'e' + i} />
              const v = iso(view.y, view.m, d)
              const sel = v === datePart, isToday = v === todayIso
              return (
                <button type="button" key={v} onClick={() => pick(v)}
                  className={`ios-cal-day${sel ? ' is-sel' : ''}${isToday ? ' is-today' : ''}`}>{d}</button>
              )
            })}
          </div>
          {withTime && (
            <div className="ios-cal-time">
              <span>Время</span>
              <input type="time" data-plain value={timePart} disabled={!valid}
                onChange={e => fire(`${datePart}T${e.target.value}`)} />
            </div>
          )}
          <div className="ios-cal-foot">
            <button type="button" onClick={() => pick(todayIso)}>Сегодня</button>
            {value && !rest.required && <button type="button" onClick={() => { fire(''); close() }} style={{ color: '#8A93A0' }}>Очистить</button>}
            {withTime && <button type="button" onClick={close} style={{ marginLeft: 'auto', fontWeight: 600 }}>Готово</button>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
