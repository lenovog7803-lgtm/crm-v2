import { useRef, useState, useLayoutEffect } from 'react'
import { useSpringPill } from '../hooks/useSpringPill'

// Переключатель-сегменты в стиле iOS 26: стеклянная дорожка и «капля» liquid glass,
// которая перетекает к выбранной вкладке на пружине и растягивается по скорости.
export function SlidingTabs({ options, value, onChange, pillColor, activeColor = '#1366F0', inactiveColor = '#5A6573', fontSize = 12.5 }) {
  const btnRefs = useRef({})
  const thumbRef = useRef(null)
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const el = btnRefs.current[value]
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, options])
  useSpringPill(thumbRef, rect?.left, rect?.width, value)

  return (
    <div className={pillColor ? undefined : 'seg-track'} style={{ position: 'relative', display: 'flex', gap: pillColor ? 8 : 2 }}>
      {rect && (
        <div ref={thumbRef} className={pillColor ? undefined : 'seg-thumb'} style={{
          position: 'absolute', left: 0,  // место и ширину ставит пружина (useSpringPill)
          top: pillColor ? 0 : 3, bottom: pillColor ? 0 : 3,
          borderRadius: 99, background: pillColor,
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
            fontFamily: 'var(--font-sys)', fontSize, fontWeight: 600,
            background: 'transparent',
            color: opt.key === value ? activeColor : inactiveColor,
            transition: 'color 0.15s var(--ease)',
          }}
        >{opt.label}</button>
      ))}
    </div>
  )
}
