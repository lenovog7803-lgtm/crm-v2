import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGoals } from '../api'
import { useNotifications } from './Toast'

// Шапка как Dynamic Island: нажатие на пустое место шапки раскрывает её вниз — план месяца;
// фоновые дела («Генерирую акт…» → «Готово») идут строкой прямо в шапке.
// Раскрытая часть — отдельный слой поверх страницы (портал), приклеенный к низу шапки: шапка сама
// из стекла, а вложенное стекло браузер за её пределами не размывает.

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

// Раскрытая часть шапки — план месяца
export function TopbarExpand({ barRef, open, onClose, onNav }) {
  const [goals, setGoals] = useState(null)
  const [rect, setRect] = useState(null)
  const panelRef = useRef(null)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => { if (open) getGoals(month).then(setGoals).catch(() => {}) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // приклеиваемся к низу шапки и к её ширине
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

  useEffect(() => {
    if (!open) return
    const away = e => { if (!panelRef.current?.contains(e.target) && !barRef.current?.contains(e.target)) onClose() }
    const esc = e => { if (e.key === 'Escape') onClose() }
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

  return createPortal(
    <div ref={panelRef} className={`topbar-expand${open ? ' is-open' : ''}`} aria-hidden={!open}
      style={{ left: rect.left, top: rect.top - 1, width: rect.width }}>
      <div className="topbar-expand-inner">
        <div className="topbar-expand-body">
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
            <button type="button" className="island-btn" tabIndex={open ? 0 : -1} onClick={() => { onClose(); onNav?.('plan') }}>Открыть План</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
