import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGoals } from '../api'
import { useNotifications } from './Toast'

// Остров в центре шапки, как Dynamic Island на iPhone, из жидкого стекла.
// В покое — прибыль месяца против цели; по нажатию — сводка месяца; пока идёт фоновое дело
// («Генерирую акт…») — крутилка и текст, по готовности — галочка.
// Свой, без cult-ui: размер меняется CSS-переходом (его можно прервать на полпути без рывка),
// содержимое всегда одно — старое и новое не накладываются.
// Живёт в отдельном слое поверх страницы (портал в body) по метке в центре шапки: шапка сама из стекла,
// а вложенное стекло браузер за её пределами не размывает.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const SIZES = {
  idle: { w: 196, h: 34, r: 17 },
  loading: { w: 320, h: 34, r: 17 },
  done: { w: 280, h: 34, r: 17 },
  open: { w: 340, h: 196, r: 26 },
}
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const pct = (f, p) => (p ? Math.min(100, Math.round(f / p * 100)) : 0)

const Spinner = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" className="island-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(19,102,240,0.18)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#1366F0" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="11" fill="#34C759" /><path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function Island({ onNav, pos }) {
  const notifications = useNotifications()
  const [goals, setGoals] = useState(null)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(null)  // только что завершённое фоновое дело — 2,5 с
  const wrapRef = useRef(null)
  const prevLoading = useRef(new Set())
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const load = () => getGoals(month).then(setGoals).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // фоновые дела — уведомления «В процессе»; стало «Готово» — короткая галочка и свежие цифры
  const loading = notifications.filter(n => n.type === 'loading')
  useEffect(() => {
    const ids = new Set(loading.map(n => n.id))
    prevLoading.current.forEach(id => {
      if (ids.has(id)) return
      const n = notifications.find(x => x.id === id)
      if (n && n.type !== 'loading') { setDone(n); load() }
    })
    prevLoading.current = ids
  }, [notifications]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(null), 2500); return () => clearTimeout(t) }, [done])

  // раскрытый закрывается кликом мимо и Escape
  useEffect(() => {
    if (!open) return
    const away = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const mode = loading.length ? 'loading' : done ? 'done' : open ? 'open' : 'idle'
  const size = SIZES[mode]
  const toggle = () => { if (mode === 'idle') setOpen(true); else if (mode === 'open') setOpen(false) }

  const g = goals || {}
  const p = pct(g.profit_fact, g.profit_goal)
  const rows = [
    { label: 'Прибыль', f: `${int(g.profit_fact)} Br`, p: int(g.profit_goal), v: pct(g.profit_fact, g.profit_goal), c: '#1366F0' },
    { label: 'Рейсы', f: int(g.trips_fact), p: int(g.trips_goal), v: pct(g.trips_fact, g.trips_goal), c: '#7C3AED' },
    { label: 'Маржа на рейс', f: `${int(g.margin_fact)} Br`, p: int(g.margin_goal), v: pct(g.margin_fact, g.margin_goal), c: '#D97706' },
  ]

  return (
    <div ref={wrapRef} className="topbar-island" style={{ left: pos.x, top: pos.y }}>
      <div className={`island island--${mode}`} role="button" tabIndex={0} aria-label="План месяца" aria-expanded={open}
        style={{ width: size.w, height: size.h, borderRadius: size.r }}
        onClick={e => { if (!e.target.closest('.island-btn')) toggle() }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}>
        <div className="island-content" key={mode}>
          {mode === 'idle' && (
            <div className="island-line">
              <span className="island-muted">{MONTHS[now.getMonth()]}</span>
              <b>{goals ? <>{int(g.profit_fact)} Br <span className="island-pct" style={{ color: p >= 100 ? '#1E9E5A' : p >= 85 ? '#D97706' : '#1366F0' }}>{p}%</span></> : '…'}</b>
            </div>
          )}
          {mode === 'loading' && (
            <div className="island-line" style={{ justifyContent: 'flex-start' }}>
              <Spinner />
              <span className="island-ellipsis">{loading[0]?.message}</span>
              {loading.length > 1 && <span className="island-muted">ещё {loading.length - 1}</span>}
            </div>
          )}
          {mode === 'done' && (
            <div className="island-line" style={{ justifyContent: 'flex-start' }}>
              <Check />
              <span className="island-ellipsis">{done?.message}</span>
            </div>
          )}
          {mode === 'open' && (
            <div className="island-open">
              <div className="island-open-head"><b>{MONTHS[now.getMonth()]} — план месяца</b><span className="island-muted">{p}%</span></div>
              {rows.map(r => (
                <div key={r.label}>
                  <div className="island-row"><span className="island-muted">{r.label}</span><span><b>{r.f}</b> <span className="island-muted">/ {r.p}</span></span></div>
                  <div className="island-bar"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
                </div>
              ))}
              <button type="button" className="island-btn" onClick={() => { setOpen(false); onNav?.('plan') }}>Открыть План</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TopbarIsland({ onNav }) {
  const anchorRef = useRef(null)
  const [pos, setPos] = useState(null)
  // метка — центр шапки; следим за размером шапки (при прокрутке она сжимается) и окна
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const place = () => { const r = el.getBoundingClientRect(); setPos(p => (p && p.x === r.left && p.y === r.top ? p : { x: r.left, y: r.top })) }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el.parentElement)
    window.addEventListener('resize', place)
    return () => { ro.disconnect(); window.removeEventListener('resize', place) }
  }, [])
  return (
    <>
      <span ref={anchorRef} className="topbar-island-anchor" aria-hidden="true" />
      {pos && createPortal(<Island onNav={onNav} pos={pos} />, document.body)}
    </>
  )
}
