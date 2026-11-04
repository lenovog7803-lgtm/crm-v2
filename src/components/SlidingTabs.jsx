import { useRef, useState, useLayoutEffect } from 'react'
import { useSpringPill } from '../hooks/useSpringPill'
import { SegmentedControl } from 'glisse'

// Переключатель-сегменты в стиле iOS 26: стеклянная дорожка и «капля» liquid glass,
// которая перетекает к выбранной вкладке на пружине и растягивается по скорости.
// Переключатель — сегменты glisse (жидкое стекло iOS 26: капля выбора тянется и «вытекает» под пальцем).
// Цветные «таблетки» (pillColor) — по-старому.
export function SlidingTabs(props) {
  if (props.pillColor) return <ClassicTabs {...props} />
  return <GlassTabs {...props} />
}

// fill — на всю ширину области (ширина сегмента = ширина / число пунктов, в пикселях: glisse двигает каплю на эту величину)
function GlassTabs({ options, value, onChange, fill }) {
  const wrapRef = useRef(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!fill || !wrapRef.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [fill])
  // у glisse все сегменты одной ширины — без fill берём по самой длинной подписи
  const longest = Math.max(...options.map(o => String(o.label).length))
  const tabW = fill && w ? Math.floor(w / options.length) : Math.max(72, longest * 8 + 30)
  const ctl = (
    <SegmentedControl style={{ '--lg-tab-width': `${tabW}px`, ...(fill ? { '--lg-tab-height': '38px' } : null) }}
      // ключи бывают числами (год, неделя) — glisse работает со строками, возвращаем исходный ключ
      items={options.map(o => ({ value: String(o.key), label: o.label }))} value={String(value)}
      onValueChange={v => onChange(options.find(o => String(o.key) === v)?.key)} />
  )
  return fill ? <div ref={wrapRef} className="glass-tabs-fill">{ctl}</div> : ctl
}

function ClassicTabs({ options, value, onChange, pillColor, activeColor = 'var(--fg-1366f0)', inactiveColor = 'var(--text-secondary)', fontSize = 12.5 }) {
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
