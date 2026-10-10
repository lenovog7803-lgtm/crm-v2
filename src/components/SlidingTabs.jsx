import { useRef, useState, useLayoutEffect } from 'react'
import { prefersReducedMotion } from '../motion'

// Переключатель-сегменты в стиле iOS 26: стеклянная дорожка и «капля» liquid glass,
// которая перетекает к выбранной вкладке и чуть растягивается в движении.
export function SlidingTabs({ options, value, onChange, pillColor, activeColor = '#1366F0', inactiveColor = '#5A6573', fontSize = 12.5 }) {
  const btnRefs = useRef({})
  const thumbRef = useRef(null)
  const prev = useRef(value)
  const [rect, setRect] = useState(null)

  useLayoutEffect(() => {
    const el = btnRefs.current[value]
    if (el) setRect({ left: el.offsetLeft, width: el.offsetWidth })
    // «желе»: капля вытягивается по ходу движения и возвращается — как в iOS 26
    if (prev.current !== value && thumbRef.current && !prefersReducedMotion()) {
      thumbRef.current.animate(
        [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.12, 0.9)' }, { transform: 'scale(1, 1)' }],
        { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    }
    prev.current = value
  }, [value, options])

  return (
    <div className={pillColor ? undefined : 'seg-track'} style={{ position: 'relative', display: 'flex', gap: pillColor ? 8 : 2 }}>
      {rect && (
        <div ref={thumbRef} className={pillColor ? undefined : 'seg-thumb'} style={{
          position: 'absolute', left: rect.left, width: rect.width,
          top: pillColor ? 0 : 3, bottom: pillColor ? 0 : 3,
          borderRadius: 99, background: pillColor,
          transition: 'left 0.32s cubic-bezier(0.22, 1, 0.36, 1), width 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
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
