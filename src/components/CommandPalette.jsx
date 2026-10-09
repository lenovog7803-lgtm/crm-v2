import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { globalSearch } from '../api'
import { useIsMobile } from '../hooks/useIsMobile'

// Быстрый поиск ⌘K в духе Spotlight: стеклянная панель без тёмной подложки, крупная строка,
// высота по содержимому; пустой запрос — быстрые переходы в разделы (⌘1…⌘5).

const SYS = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', Manrope, sans-serif"

// Цветные «иконки приложений» — квадрат со скруглением и градиентом, как в Spotlight
const ICON_PATHS = {
  order: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="13" y2="17" /></>,
  client: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></>,
  carrier: <><rect x="1" y="6" width="14" height="11" rx="1.5" /><path d="M15 10h4l3 3v4h-7" /><circle cx="6" cy="18.5" r="1.8" /><circle cx="18" cy="18.5" r="1.8" /></>,
  lead: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  task: <><rect x="3" y="3" width="18" height="18" rx="4" /><polyline points="8 12 11 15 16 9" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  mailing: <><rect x="2" y="4" width="20" height="16" rx="3" /><polyline points="22 6 12 13 2 6" /></>,
}
const GRADIENT = {
  order: ['#4F8BFF', '#1366F0'], client: ['#34C77B', '#1E9E5A'], carrier: ['#A673FF', '#7C3AED'],
  lead: ['#FFB547', '#E08600'], task: ['#FF8A5B', '#F2542D'], dashboard: ['#5AC8FA', '#0A84FF'], mailing: ['#7D7AFF', '#5856D6'],
}
function AppIcon({ kind, size = 36 }) {
  const [a, b] = GRADIENT[kind] || GRADIENT.order
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.26, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `0 2px 6px -1px ${b}66, inset 0 1px 0 rgba(255,255,255,0.35)` }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {ICON_PATHS[kind] || ICON_PATHS.order}
      </svg>
    </span>
  )
}

const GROUP = { order: 'Заявки', client: 'Клиенты', carrier: 'Перевозчики', lead: 'Лиды', task: 'Задачи' }
// сначала сами клиенты и перевозчики, потом их заявки — при поиске по названию нужная карточка сверху
const GROUP_ORDER = ['client', 'carrier', 'order', 'lead', 'task']
const QUICK = [
  { kind: 'order', key: 'orders', title: 'Заявки', sub: 'Все перевозки' },
  { kind: 'client', key: 'clients', title: 'Клиенты', sub: 'База клиентов' },
  { kind: 'carrier', key: 'carriers', title: 'Перевозчики', sub: 'База перевозчиков' },
  { kind: 'task', key: 'tasks', title: 'Задачи', sub: 'На сегодня и просроченные' },
  { kind: 'mailing', key: 'mailing', title: 'Рассылка', sub: 'Письма и ответы' },
]

function Kbd({ children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 22, height: 22, padding: '0 6px', borderRadius: 6,
      background: 'rgba(14,23,38,0.06)', border: '1px solid rgba(14,23,38,0.08)', fontSize: 12, fontWeight: 600, color: '#5A6573', fontFamily: SYS }}>
      {children}
    </span>
  )
}

export default function CommandPalette({ open, onClose, onOpenOrder, onOpenClient, onOpenCarrier, onNav }) {
  const isMobile = useIsMobile()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [closing, setClosing] = useState(false)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setActiveIdx(0); setClosing(false); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  useEffect(() => {
    if (!query || query.trim().length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(() => {
      globalSearch(query)
        .then(r => { setResults(r.results || []); setActiveIdx(0) })
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const searching = query.trim().length >= 2
  // результаты по группам, как разделы Spotlight; плоский список — для стрелок
  const groups = useMemo(() => GROUP_ORDER
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length), [results])
  const flat = searching ? groups.flatMap(g => g.items) : QUICK

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 140)
  }, [onClose])

  const select = useCallback((item) => {
    if (!item) return
    if (!searching) onNav?.(item.key)
    else if (item.type === 'order') onOpenOrder?.(item.id)
    else if (item.type === 'client') onOpenClient?.(item.id)
    else if (item.type === 'carrier') onOpenCarrier?.(item.id)
    else if (item.type === 'lead') onNav?.('leads')
    else if (item.type === 'task') onNav?.('tasks')
    onClose()
  }, [searching, onOpenOrder, onOpenClient, onOpenCarrier, onNav, onClose])

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); select(flat[activeIdx]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if ((e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) { e.preventDefault(); onNav?.(QUICK[Number(e.key) - 1].key); onClose() }
  }

  if (!open) return null

  let idx = -1
  const row = (item, title, sub, kind, trailing) => {
    idx += 1
    const i = idx
    const active = i === activeIdx
    return (
      <div key={(item.type || item.key) + (item.id || '')} data-active={active} onClick={() => select(item)} onMouseMove={() => setActiveIdx(i)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 12px', borderRadius: 12, cursor: 'default',
          background: active ? 'rgba(10,132,255,0.14)' : 'transparent', transition: 'background 80ms' }}>
        <AppIcon kind={kind} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: '#6B7380', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
        {trailing}
      </div>
    )
  }

  const sectionTitle = (t) => (
    <div style={{ padding: '10px 12px 4px', fontSize: 12, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.02em' }}>{t}</div>
  )

  return (
    <div onMouseDown={close} style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(14,23,38,0.06)',
      animation: closing ? 'fadeOut 0.14s ease-in both' : 'pageIn 0.18s ease-out' }}>
      <div onMouseDown={e => e.stopPropagation()} className="spotlight liquid-glass"
        style={{
          position: 'absolute', left: '50%', top: isMobile ? '8vh' : '16vh', transform: 'translateX(-50%)',
          width: isMobile ? 'calc(100% - 24px)' : 680, maxHeight: isMobile ? '78vh' : '64vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: SYS,
          borderRadius: 26, background: 'rgba(250,250,252,0.72)',
          backdropFilter: 'blur(40px) saturate(190%)', WebkitBackdropFilter: 'blur(40px) saturate(190%)',
          border: '1px solid rgba(255,255,255,0.65)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 0 0 0.5px rgba(14,23,38,0.12), 0 30px 80px -20px rgba(14,23,38,0.45)',
          animation: closing ? 'spotlightOut 0.14s ease-in both' : 'spotlightIn 0.26s cubic-bezier(0.22, 1, 0.36, 1) both',
        }}>
        {/* строка поиска */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: isMobile ? '14px 16px' : '18px 22px' }}>
          <svg width={isMobile ? 22 : 28} height={isMobile ? 22 : 28} viewBox="0 0 24 24" fill="none" stroke="#7A828E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7.5" /><line x1="21" y1="21" x2="16.4" y2="16.4" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск в CRM"
            aria-label="Поиск в CRM"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: SYS,
              fontSize: isMobile ? 20 : 28, fontWeight: 400, letterSpacing: '-0.02em', color: '#0E1726' }}
          />
          {loading && <ThinkingOrb state="searching" size={20} theme="light" aria-label="Ищу…" />}
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', borderTop: '1px solid rgba(14,23,38,0.08)', padding: '6px 10px 10px' }}>
          {!searching && (
            <>
              {sectionTitle('Перейти')}
              {QUICK.map((q, n) => row(q, q.title, q.sub, q.kind,
                !isMobile && <span style={{ display: 'flex', gap: 4 }}><Kbd>⌘</Kbd><Kbd>{n + 1}</Kbd></span>))}
            </>
          )}
          {searching && !loading && results.length === 0 && (
            <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 14, color: '#8A93A0' }}>Ничего не найдено по «{query.trim()}»</div>
          )}
          {searching && groups.map(g => (
            <div key={g.type}>
              {sectionTitle(GROUP[g.type])}
              {g.items.map(r => row(r, r.title, r.subtitle, r.type))}
            </div>
          ))}
        </div>

        {!isMobile && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '10px 22px', borderTop: '1px solid rgba(14,23,38,0.06)', fontSize: 12, color: '#8A93A0' }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Kbd>↑</Kbd><Kbd>↓</Kbd> выбор</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Kbd>↵</Kbd> открыть</span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Kbd>esc</Kbd> закрыть</span>
          </div>
        )}
      </div>
    </div>
  )
}
