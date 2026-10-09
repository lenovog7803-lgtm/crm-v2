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

// Две иконки в одном месте: старая растворяется с размытием и уменьшением, новая проявляется.
export function IconSwap({ on, a, b }) {
  return (
    <span className="t-icon-swap" data-state={on ? 'b' : 'a'} aria-hidden="true">
      <span className="t-icon" data-icon="a">{a}</span>
      <span className="t-icon" data-icon="b">{b}</span>
    </span>
  )
}

// Плавное раскрытие/сворачивание: высота тянется к содержимому, а не прыгает.
export function AutoHeight({ open, children }) {
  const inner = useRef(null)
  const [h, setH] = useState(open ? 'auto' : 0)
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    const el = inner.current
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setH(inner.current ? inner.current.scrollHeight : 'auto'))
      const t = setTimeout(() => setH('auto'), 320)  // после раскрытия — живая высота (содержимое может меняться)
      return () => clearTimeout(t)
    }
    if (el) {
      setH(el.scrollHeight)
      requestAnimationFrame(() => requestAnimationFrame(() => setH(0)))
    }
    const t = setTimeout(() => setMounted(false), 320)
    return () => clearTimeout(t)
  }, [open])
  return (
    <div className="t-resize" style={{ height: h, overflow: 'hidden' }}>
      <div ref={inner}>{mounted && children}</div>
    </div>
  )
}

// Тряска при ошибке: shake() — элемент с ref коротко дёргается влево-вправо.
export function useShake() {
  const ref = useRef(null)
  const shake = () => {
    const el = ref.current
    if (!el || prefersReducedMotion()) return
    el.classList.remove('t-shaking')
    void el.offsetWidth
    el.classList.add('t-shaking')
    haptic([12, 40, 12])
  }
  return [ref, shake]
}
