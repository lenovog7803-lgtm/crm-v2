import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGoals, getOrders } from '../api'
import { useNotifications } from './Toast'
import { motion } from 'motion/react'
import { prefersReducedMotion } from '../motion'

// Шапка как Dynamic Island: нажатие на пустое место шапки раскрывает её каплей вниз — сводка своей страницы;
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

// ---- Что показывает шапка на каждой странице: заголовок и 3–4 цифры, без кнопок ----
const nd = s => { s = String(s || ''); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const m = s.match(/^(\d{2})\.(\d{2})\.?(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const mg = o => (+o.client_rate || 0) - (+o.carrier_rate || 0)
const dayOf = o => nd(o.unload_date) || nd(o.load_date)
const owedByClient = o => !o.client_paid && !o.client_cash
const owedToCarrier = o => !o.carrier_paid && !o.carrier_cash
const isEmpty = o => +o.client_rate > 0 && (mg(o) < 150 || mg(o) / o.client_rate < 0.15)  // порог «пустой» заявки, как в «Плане»
const sum = (arr, f) => arr.reduce((t, o) => t + f(o), 0)
const fmtDay = d => d ? new Date(d + 'T00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : '—'

function buildIsland(page, meta, goals, orders, now) {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const year = String(now.getFullYear())
  const live = (orders || []).filter(o => o.status !== 'cancelled')
  const inMonth = live.filter(o => dayOf(o).startsWith(month))
  const inYear = live.filter(o => dayOf(o).startsWith(year))
  const ago45 = new Date(now - 45 * 864e5).toISOString().slice(0, 10)
  const MON = MONTHS[now.getMonth()]
  const g = goals || {}
  const plan = () => {
    const day = now.getDate(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return {
      title: `${MON} — план месяца`, sub: goals ? `${pct(g.profit_fact, g.profit_goal)}% выполнено` : 'Загружаю…',
      stats: [
        { label: 'Прибыль', value: `${int(g.profit_fact)} Br`, sub: `из ${int(g.profit_goal)}`, bar: pct(g.profit_fact, g.profit_goal), color: '#1366F0' },
        { label: 'Рейсы', value: int(g.trips_fact), sub: `из ${int(g.trips_goal)}`, bar: pct(g.trips_fact, g.trips_goal), color: '#7C3AED' },
        { label: 'Маржа на рейс', value: `${int(g.margin_fact)} Br`, sub: `цель ${int(g.margin_goal)}`, bar: pct(g.margin_fact, g.margin_goal), color: '#D97706' },
        { label: 'Прогноз на месяц', value: `${int(g.profit_fact ? g.profit_fact / day * days : 0)} Br`, sub: 'по текущему темпу' },
      ],
    }
  }
  if (!orders) return plan()

  if (page === 'orders') {
    const m = sum(inMonth, mg), rev = sum(inMonth, o => +o.client_rate || 0)
    const empty = inMonth.filter(isEmpty), owed = live.filter(owedByClient)
    return { title: `Заявки — ${MON.toLowerCase()}`, sub: `${inMonth.length} за месяц`, stats: [
      { label: 'Заявок', value: inMonth.length, sub: 'в этом месяце' },
      { label: 'Маржа', value: `${int(m)} Br`, sub: rev ? `${Math.round(m / rev * 100)}% от выручки` : '' },
      { label: 'Пустых и в минус', value: `${empty.length} из ${inMonth.length}`, sub: 'ниже 150 Br или 15%', color: empty.length / (inMonth.length || 1) > 0.3 ? '#D97706' : undefined },
      { label: 'Ждём оплату', value: `${int(sum(owed, o => +o.client_rate || 0))} Br`, sub: `${owed.length} заявок` },
    ] }
  }
  if (page === 'finance') {
    const owed = live.filter(owedByClient), late = owed.filter(o => dayOf(o) && dayOf(o) < ago45), toCar = live.filter(owedToCarrier)
    return { title: 'Деньги', sub: 'на сегодня', stats: [
      { label: 'Клиенты должны', value: `${int(sum(owed, o => +o.client_rate || 0))} Br`, sub: `${owed.length} заявок` },
      { label: 'Дольше 45 дней', value: `${int(sum(late, o => +o.client_rate || 0))} Br`, sub: `${late.length} заявок`, color: late.length ? '#D63B30' : undefined },
      { label: 'Мы должны перевозчикам', value: `${int(sum(toCar, o => +o.carrier_rate || 0))} Br`, sub: `${toCar.length} заявок` },
      { label: `Маржа за ${MON.toLowerCase()}`, value: `${int(sum(inMonth, mg))} Br`, sub: `${inMonth.length} заявок` },
    ] }
  }
  if (page === 'clients') {
    const by = {}
    inYear.forEach(o => { by[o.client_id] = (by[o.client_id] || 0) + mg(o) })
    const totalY = Object.values(by).reduce((a, b) => a + b, 0)
    const top5 = Object.values(by).sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0)
    const last = {}, first = {}
    live.forEach(o => { const d = dayOf(o); if (!d) return; if (!last[o.client_id] || d > last[o.client_id]) last[o.client_id] = d; if (!first[o.client_id] || d < first[o.client_id]) first[o.client_id] = d })
    const ago90 = new Date(now - 90 * 864e5).toISOString().slice(0, 10)
    const ids = Object.keys(last)
    const owed = live.filter(owedByClient)
    return { title: 'Клиенты', sub: `${ids.length} с заявками`, stats: [
      { label: 'Активные', value: `${ids.filter(id => last[id] >= ago90).length} из ${ids.length}`, sub: 'грузились за 90 дней' },
      { label: 'Новые', value: ids.filter(id => first[id].startsWith(month)).length, sub: 'первая заявка в этом месяце' },
      { label: 'Топ-5 клиентов', value: `${totalY ? Math.round(top5 / totalY * 100) : 0}%`, sub: 'маржи за год', color: totalY && top5 / totalY > 0.65 ? '#D97706' : undefined },
      { label: 'Должны', value: `${int(sum(owed, o => +o.client_rate || 0))} Br`, sub: `${owed.length} заявок` },
    ] }
  }
  if (page === 'carriers') {
    const ids = new Set(live.map(o => o.carrier_id)), month_ = new Set(inMonth.map(o => o.carrier_id))
    const toCar = live.filter(owedToCarrier)
    const top = {}
    inMonth.forEach(o => { top[o.carrier_name] = (top[o.carrier_name] || 0) + 1 })
    const [topName, topN] = Object.entries(top).sort((a, b) => b[1] - a[1])[0] || ['—', 0]
    return { title: 'Перевозчики', sub: `${ids.size} в работе за всё время`, stats: [
      { label: 'Возили в этом месяце', value: month_.size, sub: `${inMonth.length} рейсов` },
      { label: 'Чаще всех', value: topName, sub: topN ? `${topN} рейсов за месяц` : '' },
      { label: 'Мы должны', value: `${int(sum(toCar, o => +o.carrier_rate || 0))} Br`, sub: `${toCar.length} заявок` },
    ] }
  }
  if (page === 'order-detail' && meta?.title) {
    const o = live.find(x => x.order_number === meta.title)
    if (o) {
      const m = mg(o), r = +o.client_rate || 0
      return { title: 'Сводка заявки', sub: '', stats: [
        { label: 'Маржа', value: `${int(m)} Br`, sub: r ? `${Math.round(m / r * 100)}% · ${m < 0 ? 'в минус' : isEmpty(o) ? 'пустая' : 'нормальная'}` : '', color: m < 0 ? '#D63B30' : isEmpty(o) ? '#D97706' : '#1E9E5A' },
        { label: 'Клиент платит', value: `${int(r)} Br`, sub: o.client_paid || o.client_cash ? 'оплачено' : 'ждём оплату', color: o.client_paid || o.client_cash ? '#1E9E5A' : undefined },
        { label: 'Перевозчику', value: `${int(o.carrier_rate)} Br`, sub: o.carrier_paid || o.carrier_cash ? 'оплачено' : 'не оплачено', color: o.carrier_paid || o.carrier_cash ? '#1E9E5A' : undefined },
        { label: 'Выгрузка', value: fmtDay(nd(o.unload_date)), sub: o.load_date ? `загрузка ${fmtDay(nd(o.load_date))}` : '' },
      ] }
    }
  }
  if (page === 'client-detail' && meta?.title) {
    const mine = live.filter(o => o.client_name === meta.title)
    if (mine.length) {
      const yearMine = mine.filter(o => dayOf(o).startsWith(year)), allYear = sum(inYear, mg)
      const owed = mine.filter(owedByClient), last = mine.map(dayOf).filter(Boolean).sort().pop()
      return { title: 'Сводка клиента', sub: `${mine.length} заявок за всё время`, stats: [
        { label: `Маржа за ${year}`, value: `${int(sum(yearMine, mg))} Br`, sub: allYear ? `${Math.round(sum(yearMine, mg) / allYear * 100)}% всей маржи` : '' },
        { label: 'Заявок за год', value: yearMine.length, sub: yearMine.length ? `в среднем ${int(sum(yearMine, mg) / yearMine.length)} Br` : '' },
        { label: 'Должен', value: `${int(sum(owed, o => +o.client_rate || 0))} Br`, sub: `${owed.length} заявок`, color: owed.some(o => dayOf(o) < ago45) ? '#D63B30' : undefined },
        { label: 'Последняя заявка', value: fmtDay(last), sub: '' },
      ] }
    }
  }
  if (page === 'carrier-detail' && meta?.title) {
    const mine = live.filter(o => o.carrier_name === meta.title)
    if (mine.length) {
      const owed = mine.filter(owedToCarrier), last = mine.map(dayOf).filter(Boolean).sort().pop()
      return { title: 'Сводка перевозчика', sub: `${mine.length} рейсов за всё время`, stats: [
        { label: 'Рейсов за год', value: mine.filter(o => dayOf(o).startsWith(year)).length, sub: `${mine.filter(o => dayOf(o).startsWith(month)).length} в этом месяце` },
        { label: 'Мы должны', value: `${int(sum(owed, o => +o.carrier_rate || 0))} Br`, sub: `${owed.length} заявок` },
        { label: 'Маржа на его рейсах', value: `${int(sum(mine, mg))} Br`, sub: `в среднем ${int(sum(mine, mg) / mine.length)} Br` },
        { label: 'Последний рейс', value: fmtDay(last), sub: '' },
      ] }
    }
  }
  return plan()
}

// Раскрытая часть шапки — сводка своей страницы. Движение как у Dynamic Island из cult-ui (тот «чёрный остров»):
// форма перетекает по ширине и высоте на пружине motion (stiffness 400, damping 30) — капля вырастает
// из «ручки» шапки и сжимается обратно в неё. Пружину можно перехватить на ходу: motion продолжает
// с текущего размера и скорости. Содержимое лежит с полной шириной и не перестраивается — только проявляется.
const SPRING = { type: 'spring', stiffness: 400, damping: 30 }
const INTERACTIVE = 'button, a, input, select, textarea, [role="button"], [role="listbox"], .apple-select'

export function TopbarExpand({ barRef, page, meta }) {
  const [goals, setGoals] = useState(null)
  const [orders, setOrders] = useState(null)
  const [rect, setRect] = useState(null)
  const [open, setOpen] = useState(false)
  const [bodyH, setBodyH] = useState(140)
  const frameRef = useRef(null)
  const bodyRef = useRef(null)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // цифры грузим заранее и раз в 5 минут — не в момент раскрытия
  useEffect(() => {
    const load = () => {
      getGoals(month).then(setGoals).catch(() => {})
      getOrders({ limit: 5000, light: true }).then(r => setOrders(Array.isArray(r) ? r : (r?.orders || r?.data || []))).catch(() => {})
    }
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
  // высота содержимого — для конечного размера капли (меняется вместе со страницей и цифрами)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBodyH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [rect !== null]) // eslint-disable-line react-hooks/exhaustive-deps

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
  const island = buildIsland(page, meta, goals, orders, now)
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
            <b>{island.title}</b>
            {island.sub && <span className="island-muted">{island.sub}</span>}
          </div>
          <div className="topbar-expand-grid">
            {island.stats.map(st => (
              <div key={st.label} className="island-stat">
                <div className="island-muted">{st.label}</div>
                <div className="island-stat-v" style={st.color && st.bar == null ? { color: st.color } : undefined}>
                  {st.value}{st.bar != null && st.sub && <span className="island-stat-of"> {st.sub}</span>}
                </div>
                {st.bar != null ? <div className="island-bar"><div style={{ width: `${st.bar}%`, background: st.color }} /></div>
                  : st.sub ? <div className="island-stat-sub">{st.sub}</div> : null}
              </div>
            ))}
          </div>
      </motion.div>
    </div>,
    // в том же слое, что и шапка (.app-frame), — чтобы шапка была над каплей
    barRef.current?.closest('.app-frame') || document.body,
  )
}
