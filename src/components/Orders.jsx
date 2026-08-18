import { useState, useEffect, useMemo, useRef } from 'react'
import { getOrders, deleteOrder as apiDelete, updateOrder, restoreOrder } from '../api'
import { initials, statusLabel, statusColor, statusBg, getGradient, fmtDate } from '../utils'
import { useIsMobile } from '../hooks/useIsMobile'
import { SkeletonRow } from './Skeleton'
import { useToast } from './Toast'
import { EmptyState } from './EmptyState'
import { SlidingTabs } from './SlidingTabs'

const BULK_STATUSES = [
  { id: 'new', label: 'Новая' },
  { id: 'in_progress', label: 'В работе' },
  { id: 'done', label: 'Доставлено' },
  { id: 'cancelled', label: 'Отменено' },
]

const bulkBtnStyle = { background: 'transparent', border: 'none', color: '#0E1726', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, transition: 'background 0.15s' }

const DOC_FILTER_OPTIONS = [
  { key: 'docs_to_client_sent',         label: 'Отправлены клиенту',          not: false },
  { key: '!docs_to_client_sent',        label: 'НЕ отправлены клиенту',       not: true  },
  { key: 'docs_from_client_received',   label: 'Получены от клиента',          not: false },
  { key: '!docs_from_client_received',  label: 'НЕ получены от клиента',      not: true  },
  { key: 'docs_to_carrier_sent',        label: 'Отправлены перевозчику',       not: false },
  { key: '!docs_to_carrier_sent',       label: 'НЕ отправлены перевозчику',   not: true  },
  { key: 'docs_from_carrier_received',  label: 'Получены от перевозчика',      not: false },
  { key: '!docs_from_carrier_received', label: 'НЕ получены от перевозчика',  not: true  },
]

export default function Orders({ onOpenOrder, onAddOrder, refreshKey, search = '', onClearSearch, scrollToOrderId }) {
  const { show } = useToast()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  // Return-from-detail scroll restore: the row the user last opened gets
  // scrolled into view and briefly flashed once per mount, instead of
  // always landing back at the top of the list.
  const scrollTargetRef = useRef(null)
  const hasScrolledToTarget = useRef(false)
  const [flashOrderId, setFlashOrderId] = useState(null)
  const [statusFilter, setStatusFilter] = useState(() => localStorage.getItem('orders_statusFilter') || 'all')
  const [payFilter, setPayFilter] = useState(() => localStorage.getItem('orders_payFilter') || null)
  const [docFilters, setDocFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem('orders_docFilters') || '[]') } catch { return [] }
  })
  const [showDocFilter, setShowDocFilter] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [removingIds, setRemovingIds] = useState(new Set())
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)
  const isMobile = useIsMobile()

  // Mobile swipe-right-to-select (iOS-style) — one row swipes at a time,
  // tracked by id since only its transform needs to follow the finger.
  const [swipe, setSwipe] = useState({ id: null, dx: 0 })
  const swipeStart = useRef({ x: 0, y: 0 })
  const swipeAxis = useRef(null) // 'x' | 'y' — locked in after a few px so vertical scroll still works

  const handleTouchStart = (id, e) => {
    const t = e.touches[0]
    swipeStart.current = { x: t.clientX, y: t.clientY }
    swipeAxis.current = null
    setSwipe({ id, dx: 0 })
  }
  const handleTouchMove = (id, e) => {
    const t = e.touches[0]
    const dx = t.clientX - swipeStart.current.x
    const dy = t.clientY - swipeStart.current.y
    if (!swipeAxis.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipeAxis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (swipeAxis.current !== 'x' || dx < 0) return
    setSwipe({ id, dx: Math.min(dx, 90) })
  }
  const handleTouchEnd = (id) => {
    if (swipe.id === id && swipe.dx > 60) {
      if (!selectMode) setSelectMode(true)
      toggleSelect(id)
    }
    setSwipe({ id: null, dx: 0 })
    swipeAxis.current = null
  }

  const [loadError, setLoadError] = useState(false)

  const loadOrders = () => {
    setLoading(true)
    setLoadError(false)
    return getOrders()
      .then(r => setOrders(Array.isArray(r) ? r : []))
      .catch(e => {
        console.error(e)
        setLoadError(true)
        show('Не удалось загрузить заявки: ' + e.message, { type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOrders() }, [refreshKey])

  useEffect(() => {
    if (loading || !scrollToOrderId || hasScrolledToTarget.current) return
    const el = scrollTargetRef.current
    if (!el) return
    hasScrolledToTarget.current = true
    el.scrollIntoView({ block: 'center' })
    setFlashOrderId(scrollToOrderId)
    const t = setTimeout(() => setFlashOrderId(null), 1400)
    return () => clearTimeout(t)
  }, [loading, scrollToOrderId])

  useEffect(() => { localStorage.setItem('orders_statusFilter', statusFilter) }, [statusFilter])
  useEffect(() => { localStorage.setItem('orders_payFilter', payFilter || '') }, [payFilter])
  useEffect(() => { localStorage.setItem('orders_docFilters', JSON.stringify(docFilters)) }, [docFilters])

  // Scale-and-fade the row out before it actually leaves the list, instead
  // of having it just vanish the instant the delete request resolves.
  const animateRemoval = (ids) => new Promise(resolve => {
    setRemovingIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next })
    setTimeout(resolve, 200)
  })

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    await apiDelete(id).catch(console.error)
    await animateRemoval([id])
    setOrders(prev => prev.filter(o => o.id !== id))
    setRemovingIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  const handleMouseDown = (id) => {
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setSelectMode(true)
      toggleSelect(id)
    }, 500)
  }
  const handleMouseUp = () => clearTimeout(longPressTimer.current)

  const handleRowClick = (order, e) => {
    // A native click always follows mousedown+mouseup, even after a long
    // press — without this, it would immediately re-toggle (deselect)
    // the row the long press just selected.
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault()
      setSelectMode(true)
      toggleSelect(order.id)
      return
    }
    if (selectMode) { toggleSelect(order.id); return }
    onOpenOrder(order.id)
  }

  const clearSelection = () => { setSelected(new Set()); setSelectMode(false); setShowStatusMenu(false) }

  const handleBulkMarkPaid = async () => {
    const ids = [...selected]
    await Promise.all(ids.map(id => updateOrder(id, { client_paid: true, client_paid_date: new Date().toISOString() })))
    show(`Отмечено оплаченными: ${ids.length}`, { type: 'success' })
    clearSelection()
    loadOrders()
  }

  const handleBulkDelete = async () => {
    const ids = [...selected]
    const ok = window.confirm(`Удалить ${ids.length} заявок? Это действие можно отменить в течение нескольких секунд.`)
    if (!ok) return
    await Promise.all(ids.map(id => apiDelete(id)))
    await animateRemoval(ids)
    show(`Удалено заявок: ${ids.length}`, {
      type: 'info',
      actionLabel: 'Отменить',
      onAction: async () => { await Promise.all(ids.map(id => restoreOrder(id))); loadOrders() },
    })
    clearSelection()
    setRemovingIds(new Set())
    loadOrders()
  }

  const handleBulkStatus = async (status) => {
    const ids = [...selected]
    await Promise.all(ids.map(id => updateOrder(id, { status })))
    show(`Статус изменён у ${ids.length} заявок`, { type: 'success' })
    clearSelection()
    loadOrders()
  }

  const toggleDocFilter = key => {
    setDocFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  const statusChips = [
    { key: 'all', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'in_progress', label: 'В пути' },
    { key: 'done', label: 'Выполнено' },
    { key: 'cancelled', label: 'Отменено' },
  ]

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = o => o.unload_date && o.unload_date < today && o.status !== 'done' && o.status !== 'cancelled'

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const numA = parseInt(a.order_number?.match(/\d+/)?.[0] || '0')
      const numB = parseInt(b.order_number?.match(/\d+/)?.[0] || '0')
      return numB - numA
    })
  }, [orders])

  let filtered = [...sortedOrders]
  if (statusFilter === 'active') filtered = filtered.filter(o => ['new', 'in_progress'].includes(o.status))
  else if (statusFilter !== 'all') filtered = filtered.filter(o => o.status === statusFilter)
  if (payFilter === 'clientUnpaid') filtered = filtered.filter(o => !o.client_paid)
  if (payFilter === 'carrierUnpaid') filtered = filtered.filter(o => !o.carrier_paid)
  if (payFilter === 'debt') filtered = filtered.filter(o => o.client_paid && !o.carrier_paid)
  if (docFilters.length > 0) filtered = filtered.filter(o =>
    docFilters.every(f => f.startsWith('!') ? !o[f.slice(1)] : !!o[f])
  )
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(o =>
      (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
      (o.client_name && o.client_name.toLowerCase().includes(q)) ||
      (o.carrier_name && o.carrier_name.toLowerCase().includes(q)) ||
      (o.route_from && o.route_from.toLowerCase().includes(q)) ||
      (o.route_to && o.route_to.toLowerCase().includes(q)) ||
      (o.cargo && o.cargo.toLowerCase().includes(q))
    )
  }

  const hasActiveFilters = statusFilter !== 'all' || !!payFilter || docFilters.length > 0 || !!search
  const resetFilters = () => { setStatusFilter('all'); setPayFilter(null); setDocFilters([]); onClearSearch?.() }
  const emptyStateProps = hasActiveFilters
    ? { title: 'Ничего не найдено', subtitle: 'Попробуйте изменить фильтры или поисковый запрос', actionLabel: 'Сбросить фильтры', onAction: resetFilters }
    : { title: 'Пока нет заявок', subtitle: 'Создайте первую заявку, чтобы начать работу', actionLabel: 'Создать заявку', onAction: onAddOrder }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter bar */}
      <div className="card" style={{ padding: isMobile ? '10px 12px' : '14px 16px' }}>
        {/* Scrollable filter row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <SlidingTabs
            options={statusChips}
            value={statusChips.some(c => c.key === statusFilter) ? statusFilter : 'all'}
            onChange={setStatusFilter}
          />
          <div style={{ width: 1, height: 20, background: 'rgba(14,23,38,0.1)', flexShrink: 0 }} />
          <button onClick={() => setPayFilter(payFilter === 'clientUnpaid' ? null : 'clientUnpaid')} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: payFilter === 'clientUnpaid' ? 'rgba(30,158,90,0.15)' : 'rgba(14,23,38,0.06)',
            color: payFilter === 'clientUnpaid' ? '#1E9E5A' : '#5A6573',
          }}>Не оплачено клиентом</button>
          <button onClick={() => setPayFilter(payFilter === 'carrierUnpaid' ? null : 'carrierUnpaid')} style={{
            padding: '6px 14px', borderRadius: 99, border: 'none', cursor: 'pointer', flexShrink: 0,
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: payFilter === 'carrierUnpaid' ? 'rgba(124,58,237,0.15)' : 'rgba(14,23,38,0.06)',
            color: payFilter === 'carrierUnpaid' ? '#7C3AED' : '#5A6573',
          }}>Не оплачено перевозчику</button>
          <div style={{ width: 1, height: 20, background: 'rgba(14,23,38,0.1)', flexShrink: 0 }} />
          {/* Doc filter toggle button */}
          <button onClick={() => setShowDocFilter(v => !v)} style={{
            padding: '6px 14px', borderRadius: 12, cursor: 'pointer', flexShrink: 0,
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: docFilters.length > 0 ? 'rgba(19,102,240,0.12)' : showDocFilter ? 'rgba(14,23,38,0.1)' : 'rgba(14,23,38,0.06)',
            color: docFilters.length > 0 ? '#1366F0' : '#5A6573',
            border: docFilters.length > 0 ? '1px solid rgba(19,102,240,0.3)' : '1px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Документы {docFilters.length > 0 && `(${docFilters.length})`}
          </button>
          {/* Долг перевозчику */}
          <button onClick={() => setPayFilter(payFilter === 'debt' ? null : 'debt')} title="Долг перевозчику" style={{
            width: 34, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: payFilter === 'debt' ? 'rgba(217,119,6,0.18)' : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px) saturate(160%)',
            boxShadow: payFilter === 'debt' ? '0 0 0 1.5px rgba(217,119,6,0.45), inset 0 1px 0 rgba(255,255,255,0.4)' : '0 1px 3px rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
            color: payFilter === 'debt' ? '#D97706' : '#8A93A0', transition: 'all 0.2s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
          </button>
          {/* Новая заявка */}
          <button onClick={onAddOrder} title="Новая заявка" style={{
            width: 34, height: 34, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(19,102,240,0.12)', backdropFilter: 'blur(12px) saturate(160%)',
            boxShadow: '0 1px 3px rgba(14,23,38,0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
            color: '#1366F0', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(19,102,240,0.22)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(19,102,240,0.12)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Doc filter panel — inline below, no positioning */}
        {showDocFilter && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(14,23,38,0.07)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 2 }}>
              {DOC_FILTER_OPTIONS.map((f, i) => (
                <>
                  {i % 2 === 0 && i > 0 && (
                    <div key={`sep-${i}`} style={{ gridColumn: '1/-1', height: 1, background: 'rgba(14,23,38,0.05)', margin: '3px 0' }} />
                  )}
                  <label key={f.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', cursor: 'pointer', borderRadius: 9,
                    fontSize: 12.5, fontWeight: f.not ? 500 : 600,
                    color: f.not ? '#8A93A0' : '#0E1726',
                    background: docFilters.includes(f.key)
                      ? (f.not ? 'rgba(200,25,35,0.07)' : 'rgba(19,102,240,0.07)')
                      : 'transparent',
                    transition: 'background 0.12s',
                  }}>
                    <input
                      type="checkbox"
                      checked={docFilters.includes(f.key)}
                      onChange={() => toggleDocFilter(f.key)}
                      style={{ accentColor: f.not ? '#C81923' : '#1366F0', width: 14, height: 14, flexShrink: 0 }}
                    />
                    {f.label}
                  </label>
                </>
              ))}
            </div>
            {docFilters.length > 0 && (
              <button onClick={() => { setDocFilters([]); setShowDocFilter(false) }} style={{
                padding: '7px 10px', border: 'none', cursor: 'pointer', marginTop: 6,
                background: 'rgba(200,25,35,0.07)', color: '#C81923',
                fontFamily: 'Manrope', fontSize: 12, fontWeight: 600, borderRadius: 10,
                textAlign: 'left', width: '100%',
              }}>Сбросить фильтр</button>
            )}
          </div>
        )}
      </div>

      {/* Mobile: iOS-style grouped list */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {loading && (
            <div className="card" style={{ padding: '4px 16px' }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )}
          {!loading && loadError && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ color: '#8E8E93', fontSize: 14, marginBottom: 12 }}>Не удалось загрузить заявки</div>
              <button onClick={loadOrders} style={{ background: '#1366F0', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Повторить</button>
            </div>
          )}
          {!loading && !loadError && filtered.length === 0 && (
            <div className="card" style={{ padding: 0 }}><EmptyState {...emptyStateProps} /></div>
          )}
          {!loading && (
            <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
              {filtered.map((order, i) => {
                const margin = (order.client_rate || 0) - (order.carrier_rate || 0)
                const route = order.route_from && order.route_to ? `${order.route_from} → ${order.route_to}` : (order.route || '—')
                const overdue = isOverdue(order)
                const missingClientPP = order.client_paid && !order.client_pp_number && !order.client_payments?.length
                const flagged = overdue || missingClientPP
                const isSelected = selected.has(order.id)
                const dx = swipe.id === order.id ? swipe.dx : 0
                const isRemoving = removingIds.has(order.id)
                const isFlash = flashOrderId === order.id
                return (
                  <div
                    key={order.id}
                    ref={order.id === scrollToOrderId ? scrollTargetRef : null}
                    onClick={() => { if (selectMode) toggleSelect(order.id); else onOpenOrder(order.id) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '13px 16px',
                      borderBottom: i < filtered.length - 1 ? '0.5px solid rgba(14,23,38,0.1)' : 'none',
                      background: isFlash ? 'rgba(19,102,240,0.14)' : (isSelected ? '#EBF2FF' : (flagged ? 'rgba(200,25,35,0.03)' : 'transparent')),
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'rgba(14,23,38,0.06)',
                      touchAction: 'pan-y',
                      opacity: isRemoving ? 0 : 1,
                      transform: isRemoving ? `translateX(${dx}px) scale(0.95)` : `translateX(${dx}px)`,
                      transition: isRemoving ? 'opacity 0.2s var(--ease), transform 0.2s var(--ease)' : (dx === 0 ? 'transform 0.2s ease, background 0.15s' : 'none'),
                      animation: isRemoving ? 'none' : 'rise 0.3s var(--ease) both',
                      animationDelay: `${Math.min(i * 20, 240)}ms`,
                    }}
                    onTouchStart={e => { e.currentTarget.style.background = isSelected ? '#EBF2FF' : 'rgba(14,23,38,0.05)'; handleTouchStart(order.id, e) }}
                    onTouchMove={e => handleTouchMove(order.id, e)}
                    onTouchEnd={e => { e.currentTarget.style.background = isSelected ? '#EBF2FF' : (flagged ? 'rgba(200,25,35,0.03)' : 'transparent'); handleTouchEnd(order.id) }}
                  >
                    {/* Selection checkbox — shown once select mode is on, or while actively swiping past the threshold */}
                    {(selectMode || dx > 60) && (
                      <div style={{
                        width: 20, height: 20, borderRadius: 7, flexShrink: 0,
                        background: isSelected ? '#1366F0' : '#FFFFFF',
                        border: `1.5px solid ${isSelected ? '#1366F0' : '#C4CAD4'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                      </div>
                    )}
                    {/* Status dot — overdue rows get a pulsing ring behind it,
                        a quiet "this needs attention" signal beyond the red tint. */}
                    <div style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
                      {overdue && (
                        <span style={{
                          position: 'absolute', inset: 0, borderRadius: '50%',
                          background: statusColor(order.status),
                          animation: 'statusPulseRing 1.6s ease-out infinite',
                        }} />
                      )}
                      <div style={{
                        position: 'relative', width: 10, height: 10, borderRadius: '50%',
                        background: statusColor(order.status),
                        boxShadow: `0 0 0 3px ${statusBg(order.status)}`,
                      }} />
                    </div>
                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13, color: '#1366F0' }}>
                          {order.order_number || order.id}
                        </span>
                        {overdue && <span style={{ fontSize: 10, color: '#C81923', fontWeight: 700 }}>ПРОСРОЧЕНО</span>}
                        {missingClientPP && <span style={{ fontSize: 10, color: '#C81923', fontWeight: 700 }}>НЕТ ПП</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0E1726', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route}</div>
                      <div style={{ fontSize: 12, color: '#8E8E93' }}>
                        {order.client_name || '—'}
                        {order.load_date ? ` · ${fmtDate(order.load_date)}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#8E8E93', visibility: order.carrier_name ? 'visible' : 'hidden' }}>
                        {order.carrier_name || '—'}
                      </div>
                    </div>
                    {/* Right: margin + chevron */}
                    <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: margin < 0 ? '#C81923' : '#0E1726' }}>
                          {margin.toLocaleString('ru-RU')}
                        </div>
                        <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', marginTop: 3 }}>
                          <span style={{ width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: order.client_paid ? 'rgba(30,158,90,0.15)' : 'rgba(14,23,38,0.07)', color: order.client_paid ? '#1E9E5A' : '#C4CAD4' }}>К</span>
                          <span style={{ width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: order.carrier_paid ? 'rgba(124,58,237,0.15)' : 'rgba(14,23,38,0.07)', color: order.carrier_paid ? '#7C3AED' : '#C4CAD4' }}>П</span>
                        </div>
                      </div>
                      <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
                        <path d="M1 1.5L6.5 7L1 12.5" stroke="#C4CAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) minmax(0, 1fr) 110px 90px 70px',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(14,23,38,0.06)',
          background: 'rgba(14,23,38,0.02)',
        }}>
          {['ЗАЯВКА', 'МАРШРУТ', 'КЛИЕНТ', 'МАРЖА', 'ОПЛАТЫ', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#A6AEB8' }}>{h}</div>
          ))}
        </div>
        {loading && (
          <div style={{ padding: '4px 20px' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}
        {!loading && filtered.map((order, i) => {
          const margin = (order.client_rate || 0) - (order.carrier_rate || 0)
          const marginPct = order.client_rate > 0 ? Math.round(margin / order.client_rate * 100) : 0
          const route = order.route_from && order.route_to ? `${order.route_from} → ${order.route_to}` : (order.route || '—')
          const [avA, avB] = getGradient(order.client_name || '')
          const overdue = isOverdue(order)
          const missingClientPP = order.client_paid && !order.client_pp_number && !order.client_payments?.length
          const flagged = overdue || missingClientPP
          const isSelected = selected.has(order.id)
          const isRemoving = removingIds.has(order.id)
          const isFlash = flashOrderId === order.id
          return (
            <div
              key={order.id}
              ref={order.id === scrollToOrderId ? scrollTargetRef : null}
              style={{
                display: 'flex', alignItems: 'center',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid rgba(14,23,38,0.05)' : 'none',
                cursor: 'pointer',
                background: isFlash ? 'rgba(19,102,240,0.14)' : (isSelected ? '#EBF2FF' : (flagged ? 'rgba(200,25,35,0.05)' : 'transparent')),
                ...(isSelected
                  ? { boxShadow: 'inset 0 0 0 1.5px #1366F0, 0 0 0 4px rgba(19,102,240,0.12)' }
                  : { borderLeft: flagged ? '3px solid rgba(200,25,35,0.5)' : '3px solid transparent' }),
                opacity: isRemoving ? 0 : 1,
                transform: isRemoving ? 'scale(0.97)' : 'scale(1)',
                transition: isRemoving ? 'opacity 0.2s var(--ease), transform 0.2s var(--ease)' : 'background 0.12s',
                animation: isRemoving ? 'none' : 'rise 0.3s var(--ease) both',
                animationDelay: `${Math.min(i * 20, 240)}ms`,
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = flagged ? 'rgba(200,25,35,0.08)' : 'rgba(14,23,38,0.02)' }}
              onMouseLeave={e => { handleMouseUp(); if (!isSelected) e.currentTarget.style.background = flagged ? 'rgba(200,25,35,0.05)' : 'transparent' }}
              onMouseDown={() => handleMouseDown(order.id)}
              onMouseUp={handleMouseUp}
              onClick={e => handleRowClick(order, e)}
            >
              {selectMode && (
                <div style={{
                  width: 18, height: 18, borderRadius: 6, flexShrink: 0, marginRight: 12,
                  background: isSelected ? '#1366F0' : '#FFFFFF',
                  border: `1.5px solid ${isSelected ? '#1366F0' : '#C4CAD4'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                </div>
              )}
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) minmax(0, 1fr) 110px 90px 70px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 13.5, color: '#1366F0' }}>
                    {order.order_number || order.id}
                  </div>
                  {missingClientPP && <span style={{ fontSize: 9.5, color: '#C81923', fontWeight: 700 }}>НЕТ ПП</span>}
                </div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, padding: '2px 8px', borderRadius: 6,
                  background: statusBg(order.status), color: statusColor(order.status),
                  fontSize: 11, fontWeight: 600,
                }}>
                  {overdue && (
                    <span style={{ position: 'relative', width: 6, height: 6, flexShrink: 0 }}>
                      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: statusColor(order.status), animation: 'statusPulseRing 1.6s ease-out infinite' }} />
                      <span style={{ position: 'relative', width: 6, height: 6, borderRadius: '50%', background: statusColor(order.status), display: 'block' }} />
                    </span>
                  )}
                  {statusLabel(order.status)}
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: '#0E1726' }}>{route}</div>
                <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 2 }}>
                  {fmtDate(order.load_date) || '—'}{order.weight_tons ? ` · ${order.weight_tons} т` : ''}
                </div>
              </div>
              {order.client_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: `linear-gradient(135deg, ${avA} 0%, ${avB} 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 11, fontWeight: 700,
                  }}>{initials(order.client_name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.client_name}
                    </div>
                    <div style={{
                      fontSize: 11.5, color: '#A6AEB8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      visibility: order.carrier_name ? 'visible' : 'hidden',
                    }}>
                      {order.carrier_name || '—'}
                    </div>
                  </div>
                </div>
              ) : <div style={{ color: '#A6AEB8', fontSize: 13 }}>—</div>}
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0E1726' }}>{margin.toLocaleString('ru-RU')} BYN</div>
                <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 2 }}>{marginPct}%</div>
                <div style={{ fontSize: 10.5, color: '#C4CAD4', marginTop: 2, lineHeight: 1.4 }}>
                  {order.client_rate ? order.client_rate.toLocaleString('ru-RU') : '—'} / {order.carrier_rate ? order.carrier_rate.toLocaleString('ru-RU') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: order.client_paid ? 'rgba(30,158,90,0.15)' : 'rgba(14,23,38,0.07)',
                  color: order.client_paid ? '#1E9E5A' : '#A6AEB8',
                }}>К</span>
                <span style={{
                  width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: order.carrier_paid ? 'rgba(124,58,237,0.15)' : 'rgba(14,23,38,0.07)',
                  color: order.carrier_paid ? '#7C3AED' : '#A6AEB8',
                }}>П</span>
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                <button onClick={e => handleDelete(e, order.id)} style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(200,25,35,0.1)', color: '#C81923',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
                <button onClick={e => { e.stopPropagation(); onOpenOrder(order.id) }} style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(19,102,240,0.1)', color: '#1366F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
              </div>
            </div>
          )
        })}
        {!loading && loadError && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ color: '#A6AEB8', fontSize: 14, marginBottom: 12 }}>Не удалось загрузить заявки</div>
            <button onClick={loadOrders} style={{ background: '#1366F0', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Повторить</button>
          </div>
        )}
        {!loading && !loadError && filtered.length === 0 && (
          <EmptyState {...emptyStateProps} />
        )}
      </div>
      )}

      {selectMode && selected.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          {showStatusMenu && (
            <div style={{
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.7)', borderRadius: 14, padding: 8,
              display: 'flex', flexDirection: 'column', gap: 2,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 50px -12px rgba(14,23,38,0.35)', minWidth: 180,
            }}>
              {BULK_STATUSES.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleBulkStatus(s.id)}
                  style={{ ...bulkBtnStyle, textAlign: 'left', padding: '8px 10px' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >{s.label}</button>
              ))}
            </div>
          )}
          <div style={{
            background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.7)', borderRadius: 16, padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 50px -12px rgba(14,23,38,0.35)',
          }}>
            <span style={{ fontSize: 13, color: '#0E1726', fontWeight: 700 }}>Выбрано: {selected.size}</span>
            <div style={{ width: 1, height: 20, background: 'rgba(14,23,38,0.12)' }} />
            <button onClick={() => setShowStatusMenu(v => !v)} style={bulkBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Сменить статус</button>
            <button onClick={handleBulkMarkPaid} style={bulkBtnStyle} onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Отметить оплаченными</button>
            <button onClick={handleBulkDelete} style={{ ...bulkBtnStyle, color: '#C81923' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,25,35,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Удалить</button>
            <button onClick={clearSelection} style={{ ...bulkBtnStyle, color: '#8A93A0' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,23,38,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Отмена</button>
          </div>
        </div>
      )}
    </div>
  )
}
