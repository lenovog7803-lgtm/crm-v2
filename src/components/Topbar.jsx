import React, { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'

const PAGE_META = {
  dashboard: { title: 'Дашборд', subtitle: 'Обзор бизнеса' },
  orders: { title: 'Заявки', subtitle: 'Управление грузоперевозками' },
  'order-detail': { title: 'Заявка', subtitle: 'Детали перевозки' },
  finance: { title: 'Финансы', subtitle: 'Платежи и расчёты' },
  tasks: { title: 'Задачи', subtitle: 'Текущие дела и напоминания' },
  clients: { title: 'Клиенты', subtitle: 'База клиентов' },
  'client-detail': { title: 'Клиент', subtitle: 'Карточка клиента' },
  carriers: { title: 'Перевозчики', subtitle: 'База перевозчиков' },
  'carrier-detail': { title: 'Перевозчик', subtitle: 'Карточка перевозчика' },
  leads: { title: 'База обзвона', subtitle: 'Лиды и потенциальные клиенты' },
}

const PERIOD_OPTIONS = [
  { label: 'Текущий месяц', id: 'month' },
  { label: 'Прошлый месяц', id: 'last_month' },
  { label: 'Квартал', id: 'quarter' },
  { label: 'Год', id: 'year' },
  { label: 'Всё время', id: 'all' },
]

const MONTH_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const fmtMonth = m => {
  if (!m) return m
  const [y, mo] = m.split('-')
  return `${MONTH_RU[parseInt(mo) - 1]} ${y}`
}

export default function Topbar({ page, onSignOut, period = 'month', onPeriodChange, availableMonths = [], search = '', onSearchChange, overdueItems = [], onOpenOrder, onNav }) {
  const meta = PAGE_META[page] || { title: page, subtitle: '' }
  const [bellOpen, setBellOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const bellRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!bellOpen) return
    const handler = e => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bellOpen])

  const fixedIds = new Set(['month', 'last_month', 'quarter', 'year', 'all'])
  const extraMonths = availableMonths.filter(m => !fixedIds.has(m))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 20px',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 18,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -8px rgba(20,30,55,0.12)',
      marginBottom: 0,
      flexShrink: 0,
      position: 'relative',
      zIndex: 100,
    }}>
      {/* Mobile search expanded */}
      {isMobile && mobileSearchOpen ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            autoFocus
            value={search}
            onChange={e => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Поиск..."
            style={{
              flex: 1, paddingLeft: 12, paddingRight: 12,
              height: 38, borderRadius: 11,
              border: '1px solid rgba(14,23,38,0.12)',
              background: 'rgba(255,255,255,0.7)',
              fontFamily: 'Manrope', fontSize: 14, color: '#0E1726', outline: 'none',
            }}
          />
          <button onClick={() => { setMobileSearchOpen(false); onSearchChange && onSearchChange('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A93A0', padding: 4, fontSize: 13, fontFamily: 'Manrope', fontWeight: 600 }}>
            Отмена
          </button>
        </div>
      ) : (
        <>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: isMobile ? 16 : 18, color: '#0E1726', letterSpacing: '-0.02em' }}>{meta.title}</div>
        {!isMobile && <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 1 }}>{meta.subtitle}</div>}
      </div>

      {/* Mobile search icon */}
      {isMobile && (
        <button onClick={() => setMobileSearchOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5A6573', padding: 6, display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      )}

      {/* Search — desktop */}
      <div className="topbar-search" style={{ position: 'relative', width: 300 }}>
        <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#A6AEB8' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          value={search}
          onChange={e => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Поиск..."
          style={{
            width: '100%', paddingLeft: 34, paddingRight: 12,
            height: 38, borderRadius: 11,
            border: '1px solid rgba(14,23,38,0.12)',
            background: 'rgba(255,255,255,0.7)',
            fontFamily: 'Manrope', fontSize: 13.5, color: '#0E1726',
            outline: 'none',
          }}
        />
      </div>

      {/* Period — only on dashboard */}
      {page === 'dashboard' && (
        <select
          className="topbar-period"
          value={period}
          onChange={e => onPeriodChange && onPeriodChange(e.target.value)}
          style={{
            height: 38, padding: '0 12px', borderRadius: 11,
            border: '1px solid rgba(14,23,38,0.12)',
            background: 'rgba(255,255,255,0.7)',
            fontFamily: 'Manrope', fontSize: 13, fontWeight: 600, color: '#0E1726',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {PERIOD_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          {extraMonths.length > 0 && <option disabled>──────────</option>}
          {extraMonths.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
        </select>
      )}

      {/* Trash */}
      <button
        className="topbar-trash"
        onClick={() => onNav && onNav('trash')}
        title="Корзина"
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: '#5A6573', padding: 6, borderRadius: 10 }}
        onMouseEnter={e => e.currentTarget.style.color = '#C81923'}
        onMouseLeave={e => e.currentTarget.style.color = '#5A6573'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>

      {/* Bell */}
      <div ref={bellRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setBellOpen(v => !v)}
          style={{ position: 'relative', background: bellOpen ? 'rgba(200,25,35,0.08)' : 'none', border: 'none', cursor: 'pointer', color: overdueItems.length > 0 ? '#C81923' : '#5A6573', padding: 6, borderRadius: 10 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {overdueItems.length > 0 && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              minWidth: 16, height: 16, borderRadius: 8, background: '#C81923',
              border: '2px solid #fff', color: '#fff',
              fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px',
            }}>{overdueItems.length > 9 ? '9+' : overdueItems.length}</span>
          )}
        </button>
        {bellOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 9999,
            background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)',
            borderRadius: 18, border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 20px 60px rgba(20,30,55,0.18)',
            minWidth: 320, maxWidth: 380, overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(14,23,38,0.07)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: '#A6AEB8' }}>
                {overdueItems.length > 0 ? `ПРОСРОЧЕНО · ${overdueItems.length}` : 'УВЕДОМЛЕНИЯ'}
              </span>
            </div>
            {overdueItems.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Просроченных нет</div>
            ) : (
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {overdueItems.map(item => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => { if (item.type === 'order' && onOpenOrder) { onOpenOrder(item.id); setBellOpen(false) } }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 16px', cursor: item.type === 'order' ? 'pointer' : 'default',
                      borderBottom: '1px solid rgba(14,23,38,0.05)', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { if (item.type === 'order') e.currentTarget.style.background = 'rgba(200,25,35,0.05)' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: item.type === 'order' ? 'rgba(200,25,35,0.1)' : 'rgba(217,119,6,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: item.type === 'order' ? '#C81923' : '#D97706',
                    }}>
                      {item.type === 'order' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: '#C81923', marginTop: 2 }}>Просрочено · {item.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign out */}
      {onSignOut && (
        <button className="topbar-signout" onClick={onSignOut} title="Выйти" style={{
          background: 'rgba(14,23,38,0.06)', border: 'none', cursor: 'pointer',
          color: '#8A93A0', padding: 8, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      )}
      </>
      )}
    </div>
  )
}
