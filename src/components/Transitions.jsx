import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, haptic } from '../motion'

// Анимации из transitions.dev (стили — .t-* в index.css).

// Галочка, которая «прорисовывается» — только когда состояние сменилось на «готово»
// у пользователя на глазах. При открытии страницы уже отмеченное стоит без анимации.
export function SuccessCheck({ show, size = 11, color = '#fff', strokeWidth = 3.5 }) {
  const was = useRef(show)
  const [animate, setAnimate] = useState(false)
  useEffect(() => {
    if (show && !was.current) { setAnimate(true); haptic(12) }
    was.current = show
  }, [show])
  if (!show) return null
  return (
    <span className="t-success-check" data-state={animate ? 'in' : 'static'} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

// Число, у которого цифры «выпрыгивают», когда значение меняется (живые обновления).
// При первом показе — без анимации.
export function PopNumber({ value }) {
  const str = String(value ?? '')
  const [gen, setGen] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setGen(g => g + 1)
  }, [str])
  const chars = str.split('')
  return (
    <span key={gen} className={`t-digit-group${gen ? ' is-animating' : ''}`}>
      {chars.map((ch, i) => (
        <span key={i} className="t-digit"
          data-stagger={chars.length > 1 && i === chars.length - 2 ? '1' : chars.length > 1 && i === chars.length - 1 ? '2' : undefined}>
          {ch}
        </span>
      ))}
    </span>
  )
}

// Текст, который сменяется плавно: старый уходит вверх с размытием, новый приходит снизу.
// Для кнопок «Сохранить → Сохраняю… → Сохранено ✓».
export function SwapText({ children }) {
  const text = Array.isArray(children) ? children.join('') : String(children ?? '')
  const [shown, setShown] = useState(text)
  const [phase, setPhase] = useState('')
  useEffect(() => {
    if (text === shown) return
    if (prefersReducedMotion()) { setShown(text); return }
    setPhase('is-exit')
    const t = setTimeout(() => {
      setShown(text)
      setPhase('is-enter-start')
      requestAnimationFrame(() => requestAnimationFrame(() => setPhase('')))
    }, 200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  return <span className={`t-text-swap ${phase}`}>{shown}</span>
}
