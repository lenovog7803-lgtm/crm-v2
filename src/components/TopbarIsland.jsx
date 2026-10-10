import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGoals } from '../api'
import { useNotifications } from './Toast'
import { motion } from 'motion/react'
import { prefersReducedMotion } from '../motion'

// Шапка как Dynamic Island: нажатие на пустое место шапки раскрывает её каплей вниз — план месяца;
// фоновые дела («Генерирую акт…» → «Готово») идут строкой прямо в шапке.

// панель заходит под шапку на столько пикселей: шапка (выше по слою) прикрывает её верх — получается один остров
const TUCK = 22
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const pct = (f, p) => (p ? Math.min(100, Math.round(f / p * 100)) : 0)

const Spinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" className="island-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(19,102,240,0.18)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#1366F0" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="11" fill="#34C759" /><path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

// Строка фонового дела в шапке: крутилка, по готовности — галочка на 2,5 с; иначе ничего
export function TopbarActivity({ onDone }) {
  const notifications = useNotifications()
  const [done, setDone] = useState(null)
  const prev = useRef(new Set())
  const loading = notifications.filter(n => n.type === 'loading')
  useEffect(() => {
    const ids = new Set(loading.map(n => n.id))
    prev.current.forEach(id => {
      if (ids.has(id)) return
      const n = notifications.find(x => x.id === id)
      if (n && n.type !== 'loading') { setDone(n); onDone?.() }
    })
    prev.current = ids
  }, [notifications]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(null), 2500); return () => clearTimeout(t) }, [done])

  if (!loading.length && !done) return null
  return (
    <div className="topbar-activity" key={loading.length ? 'l' : 'd'} role="status">
      {loading.length ? <Spinner /> : <Check />}
      <span>{loading.length ? loading[0].message : done.message}</span>
      {loading.length > 1 && <span className="island-muted">ещё {loading.length - 1}</span>}
    </div>
  )
}

// Раскрытая часть шапки — план месяца. Движение как у Dynamic Island из cult-ui (тот «чёрный остров»):
// форма перетекает по ширине и высоте на пружине motion (stiffness 400, damping 30) — капля вырастает
// из «ручки» шапки и сжимается обратно в неё. Пружину можно перехватить на ходу: motion продолжает
// с текущего размера и скорости. Содержимое лежит с полной шириной и не перестраивается — только проявляется.
const SPRING = { type: 'spring', stiffness: 400, damping: 30 }
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="listbox"], .apple-select'

export function TopbarExpand({ barRef, onNav, page }) {
  const [goals, setGoals] = useState(null)
  const [rect, setRect] = useState(null)
  const [open, setOpen] = useState(false)
  const [bodyH, setBodyH] = useState(140)
  const frameRef = useRef(null)
  const bodyRef = useRef(null)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // цифры грузим заранее и раз в 5 минут — не в момент раскрытия
  useEffect(() => {
    const load = () => getGoals(month).then(setGoals).catch(() => {})
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // приклеиваемся к низу шапки и к её ширине; высота содержимого — для конечного размера капли
  useLayoutEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const place = () => { const r = bar.getBoundingClientRect(); setRect({ left: r.left, top: r.bottom, width: r.width }) }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(bar)
    window.addEventListener('resize', place)
    return () => { ro.disconnect(); window.removeEventListener('resize', place) }
  }, [barRef])
  useLayoutEffect(() => { if (bodyRef.current) setBodyH(bodyRef.current.offsetHeight) }, [goals, rect?.width])

  useEffect(() => { setOpen(false) }, [page])
  // шапка стыкуется с каплей: прямые нижние углы, пока капля открыта (снимаются по окончании закрытия)
  useEffect(() => { if (open) barRef.current?.classList.add('topbar-joined') }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // нажатие на пустое место шапки: ручка подсвечивается сразу (pointerdown), переключение — на отпускании
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    let pressed = false
    const down = e => { if (e.button === 0 && !e.target.closest(INTERACTIVE)) { pressed = true; bar.classList.add('topbar-pressed') } }
    const up = e => {
      bar.classList.remove('topbar-pressed')
      if (pressed && !e.target.closest(INTERACTIVE)) setOpen(o => !o)
      pressed = false
    }
    const cancel = () => { pressed = false; bar.classList.remove('topbar-pressed') }
    bar.addEventListener('pointerdown', down)
    bar.addEventListener('pointerup', up)
    bar.addEventListener('pointercancel', cancel)
    bar.addEventListener('pointerleave', cancel)
    return () => {
      bar.removeEventListener('pointerdown', down); bar.removeEventListener('pointerup', up)
      bar.removeEventListener('pointercancel', cancel); bar.removeEventListener('pointerleave', cancel)
    }
  }, [barRef])

  // клик мимо и Escape — закрыть
  useEffect(() => {
    if (!open) return
    const away = e => { if (!frameRef.current?.contains(e.target) && !barRef.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!rect) return null
  const g = goals || {}
  const day = now.getDate(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const forecast = g.profit_fact ? g.profit_fact / day * days : 0
  const rows = [
    { label: 'Прибыль', f: `${int(g.profit_fact)} Br`, p: int(g.profit_goal), v: pct(g.profit_fact, g.profit_goal), c: '#1366F0' },
    { label: 'Рейсы', f: int(g.trips_fact), p: int(g.trips_goal), v: pct(g.trips_fact, g.trips_goal), c: '#7C3AED' },
    { label: 'Маржа на рейс', f: `${int(g.margin_fact)} Br`, p: int(g.margin_goal), v: pct(g.margin_fact, g.margin_goal), c: '#D97706' },
  ]
  const reduce = prefersReducedMotion()

  return createPortal(
    <div ref={frameRef} className="topbar-expand" aria-hidden={!open}
      style={{ left: rect.left, top: rect.top - 7, width: rect.width, pointerEvents: open ? 'auto' : 'none' }}>
      {/* фон капли: нарисован один раз в полном размере, пружина растягивает его из ручки через scale —
          видеокарта двигает без перерисовки (ширина/высота перерисовывали бы фон и тень на каждом кадре) */}
      <motion.div className="topbar-drop" style={{ width: rect.width, height: bodyH + 7, transformOrigin: '50% 0' }}
        initial={false}
        animate={open ? { scaleX: 1, scaleY: 1, opacity: 1 } : { scaleX: 36 / rect.width, scaleY: 4 / (bodyH + 7), opacity: 0 }}
        transition={reduce ? { duration: 0 } : { ...SPRING, opacity: { duration: open ? 0.1 : 0.16, delay: open ? 0 : 0.12 } }}
        onAnimationComplete={() => { if (!open) barRef.current?.classList.remove('topbar-joined') }} />
      {/* содержимое — отдельным слоем поверх фона: не растягивается, только проявляется */}
      <motion.div ref={bodyRef} className="topbar-expand-body" style={{ width: rect.width }}
          initial={false}
          animate={open ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={reduce ? { duration: 0 } : { opacity: { duration: open ? 0.22 : 0.08, delay: open ? 0.1 : 0 }, y: SPRING }}>
          <div className="topbar-expand-head">
            <b>{MONTHS[now.getMonth()]} — план месяца</b>
            <span className="island-muted">{goals ? `${pct(g.profit_fact, g.profit_goal)}% · прогноз на конец месяца ${int(forecast)} Br` : 'Загружаю…'}</span>
          </div>
          <div className="topbar-expand-grid">
            {rows.map(r => (
              <div key={r.label}>
                <div className="island-row"><span className="island-muted">{r.label}</span><span><b>{r.f}</b> <span className="island-muted">/ {r.p}</span></span></div>
                <div className="island-bar"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
              </div>
            ))}
            <button type="button" className="island-btn" tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); onNav?.('plan') }}>Открыть План</button>
          </div>
      </motion.div>
    </div>,
    // в том же слое, что и шапка (.app-frame), — чтобы шапка была над каплей
    barRef.current?.closest('.app-frame') || document.body,
  )
}
