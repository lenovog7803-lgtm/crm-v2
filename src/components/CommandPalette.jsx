import { useState, useEffect, useRef, useCallback } from 'react'
import { globalSearch } from '../api'

const TYPE_LABEL = { order: 'Заявка', client: 'Клиент', carrier: 'Перевозчик', lead: 'Лид', task: 'Задача' }
const TYPE_COLOR = { order: '#1366F0', client: '#1E9E5A', carrier: '#7C3AED', lead: '#D97706', task: '#8A93A0' }

export default function CommandPalette({ open, onClose, onOpenOrder, onOpenClient, onOpenCarrier, onNav }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) { setQuery(''); setResults([]); setActiveIdx(0); setTimeout(() => inputRef.current?.focus(), 50) }
  }, [open])

  useEffect(() => {
    if (!query || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      globalSearch(query).then(r => { setResults(r.results || []); setActiveIdx(0) }).catch(() => {})
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const select = useCallback((item) => {
    if (!item) return
    if (item.type === 'order') onOpenOrder?.(item.id)
    else if (item.type === 'client') onOpenClient?.(item.id)
    else if (item.type === 'carrier') onOpenCarrier?.(item.id)
    else if (item.type === 'lead') onNav?.('leads')
    else if (item.type === 'task') onNav?.('tasks')
    onClose()
  }, [onOpenOrder, onOpenClient, onOpenCarrier, onNav, onClose])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); select(results[activeIdx]) }
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 2100, overflowY: 'auto', display: 'grid', padding: '10vh 24px 24px' }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: '0 auto', width: '100%', maxWidth: 560, background: '#FFFFFF', borderRadius: 20, boxShadow: '0 40px 90px rgba(14,23,38,0.35)', overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #E8EAEE' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Поиск заявки, клиента, перевозчика, лида, задачи…"
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, color: '#0E1726', background: 'transparent' }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: results.length ? 8 : 0 }}>
          {query.trim().length >= 2 && results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: '#8A93A0' }}>Ничего не найдено</div>
          )}
          {results.map((r, i) => (
            <div
              key={r.type + r.id}
              onClick={() => select(r)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: i === activeIdx ? '#F0F4FF' : 'transparent',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_COLOR[r.type], background: TYPE_COLOR[r.type] + '18', borderRadius: 8, padding: '3px 8px', flexShrink: 0 }}>
                {TYPE_LABEL[r.type]}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ fontSize: 11, color: '#8A93A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subtitle}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '9px 16px', borderTop: '1px solid #E8EAEE', display: 'flex', gap: 14, fontSize: 11, color: '#A6AEB8' }}>
          <span>↑↓ навигация</span><span>Enter открыть</span><span>Esc закрыть</span>
        </div>
      </div>
    </div>
  )
}
