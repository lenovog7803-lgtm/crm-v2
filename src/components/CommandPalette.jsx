import ModalScrim from './ModalScrim'
import GlassDialog from './GlassDialog'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { globalSearch } from '../api'
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

export default function CommandPalette({ open, onClose, onOpenOrder, onOpenClient, onOpenCarrier, onNav }) {
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
  const row = (item, title, sub) => {
    idx += 1
    const i = idx
    const active = i === activeIdx
    return (
      <div key={(item.type || item.key) + (item.id || '')} data-active={active} onClick={() => select(item)} onMouseMove={() => setActiveIdx(i)}
        style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
          background: active ? 'rgba(var(--rgb-10-132-255), 0.14)' : 'transparent', transition: 'background 80ms' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{title}</div>
          {sub && <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
        </div>
      </div>
    )
  }

  const sectionTitle = (t) => (
    <div style={{ padding: '10px 12px 4px', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.02em' }}>{t}</div>
  )

  return (
    <ModalScrim className="spotlight-scrim search-dialog-overlay" data-closing={closing} onMouseDown={close}>
      <GlassDialog label="Поиск в CRM" onDismiss={close} onMouseDown={e => e.stopPropagation()} className="spotlight">
        <div className="search-dialog-header">
          <svg width="20" height="20" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7.5" /><line x1="21" y1="21" x2="16.4" y2="16.4" />
          </svg>
          <input
            data-dialog-initial
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск в CRM"
            aria-label="Поиск в CRM"
            data-plain
          />
          {loading && <span role="status" className="search-dialog-loading">Поиск…</span>}
          <button type="button" className="ios-sheet-close" aria-label="Закрыть" onClick={close}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="m2.5 2.5 7 7m0-7-7 7" />
            </svg>
          </button>
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', borderTop: '1px solid rgba(var(--ink-rgb), 0.08)', padding: '6px 10px 10px' }}>
          {!searching && (
            <>
              {sectionTitle('Перейти')}
              {QUICK.map(q => row(q, q.title))}
            </>
          )}
          {searching && !loading && results.length === 0 && (
            <div style={{ padding: '22px 12px', textAlign: 'center', fontSize: 14, color: 'var(--text-3)' }}>Ничего не найдено по «{query.trim()}»</div>
          )}
          {searching && groups.map(g => (
            <div key={g.type}>
              {sectionTitle(GROUP[g.type])}
              {g.items.map(r => row(r, r.title, r.subtitle))}
            </div>
          ))}
        </div>

      </GlassDialog>
    </ModalScrim>
  )
}
