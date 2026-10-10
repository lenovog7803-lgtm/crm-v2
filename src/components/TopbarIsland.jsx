import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DynamicIsland, DynamicIslandProvider, DynamicContainer, DynamicTitle, DynamicDescription, useDynamicIslandSize,
} from '../bklit/components/dynamic-island'
import { getGoals } from '../api'
import { useNotifications } from './Toast'
import '../bklit/bklit.css'

// Dynamic Island в центре шапки, как на iPhone, из жидкого стекла (как уведомления).
// Сам остров живёт в отдельном слое поверх страницы (портал в body) и ставится по метке в центре шапки:
// шапка сама из стекла, и вложенное стекло браузер за её пределами не размывает — раскрытый остров был бы мутным.
// В покое — прибыль месяца против цели; по нажатию — раскрывается сводка месяца;
// пока идёт фоновое дело («Генерирую акт…») — крутилка и текст, по готовности — галочка.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const pct = (f, p) => (p ? Math.min(100, Math.round(f / p * 100)) : 0)

const Spinner = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" className="island-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(19,102,240,0.18)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#1366F0" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#34C759" /><path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function IslandBody({ onNav, pos }) {
  // setSize из cult-ui не пускает обратно к предыдущему размеру (раскрыл → свернуть игнорировалось),
  // поэтому размер ставим напрямую через dispatch
  const { state, dispatch } = useDynamicIslandSize()
  const notifications = useNotifications()
  const [goals, setGoals] = useState(null)
  const [done, setDone] = useState(null)  // только что завершённое фоновое дело — показываем 2,5 с
  const wrapRef = useRef(null)
  const prevLoading = useRef(new Set())
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const load = () => getGoals(month).then(setGoals).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // фоновые дела — уведомления «В процессе»; когда такое стало «Готово» — короткая галочка
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

  const [open, setOpen] = useState(false)
  const mode = loading.length ? 'loading' : done ? 'done' : open ? 'open' : 'idle'
  useEffect(() => {
    const size = { loading: 'long', done: 'compactLong', open: 'tall', idle: 'compact' }[mode]
    if (size !== state.size) dispatch({ type: 'SET_SIZE', newSize: size })
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // раскрытый остров закрывается кликом мимо и Escape
  useEffect(() => {
    if (!open) return
    const away = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const g = goals || {}
  const p = pct(g.profit_fact, g.profit_goal)
  const rows = [
    { label: 'Прибыль', f: `${int(g.profit_fact)} Br`, p: `${int(g.profit_goal)}`, v: pct(g.profit_fact, g.profit_goal), c: '#1366F0' },
    { label: 'Рейсы', f: int(g.trips_fact), p: int(g.trips_goal), v: pct(g.trips_fact, g.trips_goal), c: '#7C3AED' },
    { label: 'Маржа на рейс', f: `${int(g.margin_fact)} Br`, p: int(g.margin_goal), v: pct(g.margin_fact, g.margin_goal), c: '#D97706' },
  ]

  const content = {
    loading: (
      <DynamicContainer className="flex h-full w-full items-center gap-2 px-3.5 island-fg">
        <Spinner />
        <DynamicTitle className="island-text flex-1 truncate text-left text-[13px] font-medium">{loading[0]?.message}</DynamicTitle>
        {loading.length > 1 && <DynamicDescription className="text-xs island-muted">ещё {loading.length - 1}</DynamicDescription>}
      </DynamicContainer>
    ),
    done: (
      <DynamicContainer className="flex h-full w-full items-center gap-2 px-3.5 island-fg">
        <Check />
        <DynamicTitle className="island-text flex-1 truncate text-left text-[13px] font-medium">{done?.message}</DynamicTitle>
      </DynamicContainer>
    ),
    open: (
      <DynamicContainer className="flex h-full w-full flex-col justify-between px-4 py-3.5 text-left island-fg">
        <div className="flex items-baseline justify-between">
          <DynamicTitle className="text-[15px] font-bold">{MONTHS[now.getMonth()]} — план месяца</DynamicTitle>
          <DynamicDescription className="text-xs island-muted">{p}%</DynamicDescription>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs"><span className="island-muted">{r.label}</span><span className="font-semibold">{r.f} <span className="island-muted">/ {r.p}</span></span></div>
              <div className="island-bar"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
            </div>
          ))}
        </div>
        <button type="button" className="island-btn" onClick={() => { setOpen(false); onNav?.('plan') }}>Открыть План</button>
      </DynamicContainer>
    ),
    idle: (
      <DynamicContainer className="flex h-full w-full items-center justify-between px-3.5 island-fg">
        <DynamicDescription className="text-xs island-muted">{MONTHS[now.getMonth()]}</DynamicDescription>
        <DynamicTitle className="island-text text-[13px] font-semibold">
          {goals ? <>{int(g.profit_fact)} Br <span className="island-pct" style={{ color: p >= 100 ? '#1E9E5A' : p >= 85 ? '#D97706' : '#1366F0' }}>{p}%</span></> : '…'}
        </DynamicTitle>
      </DynamicContainer>
    ),
  }[mode]

  return (
    <div ref={wrapRef} className="topbar-island" role="button" tabIndex={0} aria-label="План месяца"
      aria-expanded={open} style={{ left: pos.x, top: pos.y }}
      onClick={e => { if (e.target.closest('.island-btn')) return; if (mode === 'idle') setOpen(true); else if (mode === 'open') setOpen(false) }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (mode === 'idle') setOpen(true); else if (mode === 'open') setOpen(false) } }}>
      <DynamicIsland id="topbar-island">{content}</DynamicIsland>
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
    const place = () => { const r = el.getBoundingClientRect(); setPos({ x: r.left, y: r.top }) }
    place()
    const ro = new ResizeObserver(place)
    ro.observe(el.parentElement)
    window.addEventListener('resize', place)
    return () => { ro.disconnect(); window.removeEventListener('resize', place) }
  }, [])
  return (
    <>
      <span ref={anchorRef} className="topbar-island-anchor" aria-hidden="true" />
      {pos && createPortal(
        <DynamicIslandProvider initialSize="compact">
          <IslandBody onNav={onNav} pos={pos} />
        </DynamicIslandProvider>,
        document.body,
      )}
    </>
  )
}
