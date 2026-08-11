import { useEffect, useRef, useState } from 'react'

export function CircularProgress({ pct, color, size = 56, stroke = 6, duration = 800 }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null
    const target = Math.max(0, Math.min(Number(pct) || 0, 100))

    let raf
    const tick = (t) => {
      if (!startRef.current) startRef.current = t
      const progress = Math.min((t - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(fromRef.current + (target - fromRef.current) * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct])

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - display / 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(14,23,38,0.07)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
      />
    </svg>
  )
}
