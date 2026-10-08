import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../motion'

export function CountUp({ value, duration = 700, format = (v) => Math.round(v).toLocaleString('ru-RU') }) {
  const [display, setDisplay] = useState(0)
  const startRef = useRef(null)
  const fromRef = useRef(0)

  useEffect(() => {
    fromRef.current = display
    startRef.current = null
    const target = Number(value) || 0
    if (prefersReducedMotion()) { setDisplay(target); return }  // «уменьшить движение» — сразу итог

    let raf
    const tick = (t) => {
      if (!startRef.current) startRef.current = t
      const progress = Math.min((t - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(fromRef.current + (target - fromRef.current) * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{format(display)}</>
}
