import { useRef, useState, useLayoutEffect } from 'react'

// A row of mutually-exclusive tab buttons with one pill that glides between
// them (Telegram-style), instead of each button just flipping its own fill.
export function SlidingTabs({ options, value, onChange, pillColor = 'rgba(19,102,240,0.1)', activeColor = '#1366F0', inactiveColor = '#5A6573', fontSize = 12.5 }) {
  const btnRefs = useRef({})
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const el = btnRefs.current[value]
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, options])

  return (
    <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
      {rect && (
        <div style={{
          position: 'absolute', left: rect.left, width: rect.width, top: 0, bottom: 0,
          borderRadius: 99, background: pillColor,
          transition: 'left 0.25s var(--ease), width 0.25s var(--ease)',
          zIndex: 0,
        }} />
      )}
      {options.map(opt => (
        <button
          key={opt.key}
          ref={el => { btnRefs.current[opt.key] = el }}
          onClick={() => onChange(opt.key)}
          style={{
            position: 'relative', zIndex: 1, flexShrink: 0,
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize, fontWeight: 600,
            background: 'transparent',
            color: opt.key === value ? activeColor : inactiveColor,
            transition: 'color 0.15s var(--ease)',
          }}
        >{opt.label}</button>
      ))}
    </div>
  )
}
