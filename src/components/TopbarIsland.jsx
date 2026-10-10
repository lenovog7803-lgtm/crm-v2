import { useEffect, useRef, useState } from 'react'
import {
  DynamicIsland, DynamicIslandProvider, DynamicContainer, DynamicTitle, DynamicDescription, useDynamicIslandSize,
} from '../bklit/components/dynamic-island'
import { getGoals } from '../api'
import { useNotifications } from './Toast'
import '../bklit/bklit.css'

// Dynamic Island в центре шапки, как на iPhone.
// В покое — прибыль месяца против цели; по нажатию — раскрывается сводка месяца;
// пока идёт фоновое дело («Генерирую акт…») — крутилка и текст, по готовности — галочка.

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const pct = (f, p) => (p ? Math.min(100, Math.round(f / p * 100)) : 0)

const Spinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" className="island-spin" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#34C759" /><path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function IslandBody({ onNav }) {
  const { state, setSize } = useDynamicIslandSize()
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
    setSize({ loading: 'long', done: 'compactLong', open: 'tall', idle: 'compact' }[mode])
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // раскрытый остров закрывается кликом мимо и Escape
  useEffect(() => {
    if (!open) return
    const away = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const g = goals || {}
  const p = pct(g.profit_fact, g.profit_goal)
  const rows = [
    { label: 'Прибыль', f: `${int(g.profit_fact)} Br`, p: `${int(g.profit_goal)}`, v: pct(g.profit_fact, g.profit_goal), c: '#4C8DFF' },
    { label: 'Рейсы', f: int(g.trips_fact), p: int(g.trips_goal), v: pct(g.trips_fact, g.trips_goal), c: '#B78CFF' },
    { label: 'Маржа на рейс', f: `${int(g.margin_fact)} Br`, p: int(g.margin_goal), v: pct(g.margin_fact, g.margin_goal), c: '#FFB340' },
  ]

  const content = {
    loading: (
      <DynamicContainer className="flex h-full w-full items-center gap-3 px-5 text-white">
        <Spinner />
        <DynamicTitle className="island-text flex-1 truncate text-left text-sm font-semibold">{loading[0]?.message}</DynamicTitle>
        {loading.length > 1 && <DynamicDescription className="text-xs text-white/60">ещё {loading.length - 1}</DynamicDescription>}
      </DynamicContainer>
    ),
    done: (
      <DynamicContainer className="flex h-full w-full items-center gap-2.5 px-4 text-white">
        <Check />
        <DynamicTitle className="island-text flex-1 truncate text-left text-sm font-semibold">{done?.message}</DynamicTitle>
      </DynamicContainer>
    ),
    open: (
      <DynamicContainer className="flex h-full w-full flex-col justify-between px-5 py-4 text-left text-white">
        <div className="flex items-baseline justify-between">
          <DynamicTitle className="text-base font-bold">{MONTHS[now.getMonth()]} — план месяца</DynamicTitle>
          <DynamicDescription className="text-xs text-white/60">{p}%</DynamicDescription>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map(r => (
            <div key={r.label}>
              <div className="flex justify-between text-xs"><span className="text-white/70">{r.label}</span><span className="font-semibold">{r.f} <span className="text-white/50">/ {r.p}</span></span></div>
              <div className="island-bar"><div style={{ width: `${r.v}%`, background: r.c }} /></div>
            </div>
          ))}
        </div>
        <button type="button" className="island-btn" onClick={() => { setOpen(false); onNav?.('plan') }}>Открыть План</button>
      </DynamicContainer>
    ),
    idle: (
      <DynamicContainer className="flex h-full w-full items-center justify-between px-4 text-white">
        <DynamicDescription className="text-xs text-white/60">{MONTHS[now.getMonth()]}</DynamicDescription>
        <DynamicTitle className="island-text text-sm font-semibold">
          {goals ? <>{int(g.profit_fact)} Br <span className="island-pct" style={{ color: p >= 100 ? '#34C759' : p >= 85 ? '#FFB340' : '#fff' }}>{p}%</span></> : '…'}
        </DynamicTitle>
      </DynamicContainer>
    ),
  }[mode]

  return (
    <div ref={wrapRef} className="topbar-island" role="button" tabIndex={0} aria-label="План месяца"
      onClick={() => mode === 'idle' && setOpen(true)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && mode === 'idle') { e.preventDefault(); setOpen(true) } }}>
      <DynamicIsland id="topbar-island">{content}</DynamicIsland>
    </div>
  )
}

export default function TopbarIsland({ onNav }) {
  return (
    <DynamicIslandProvider initialSize="compact">
      <IslandBody onNav={onNav} />
    </DynamicIslandProvider>
  )
}
