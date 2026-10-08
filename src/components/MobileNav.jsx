import { useRef, useState, useLayoutEffect } from 'react'
import { useAuth } from '../AuthContext'
import { ModalOverlay, ModalHeader } from './Modal'

// Нижняя панель на телефоне — не больше 5 вкладок (как в iOS); всё остальное — в «Ещё».
// Раньше «Рассылка», «База обзвона», «Автопарк» и др. с телефона были недоступны вовсе.
const MORE_SECTIONS = [
  { title: 'Работа с клиентами', items: [
    { key: 'clients', label: 'Клиенты' },
    { key: 'carriers', label: 'Перевозчики' },
    { key: 'leads', label: 'База обзвона', badge: 'newLeads' },
    { key: 'mailing', label: 'Рассылка', badge: 'newReplies', director: true },
  ] },
  { title: 'Свой автопарк', fleet: true, items: [
    { key: 'fleet-dashboard', label: 'Дашборд автопарка' },
    { key: 'fleet-trips', label: 'Рейсы' },
    { key: 'fleet-clients', label: 'Клиенты автопарка' },
    { key: 'fleet-vehicles', label: 'Машины и водители' },
  ] },
  { title: 'Отчёты и учёт', director: true, items: [
    { key: 'reports', label: 'Отчёты' },
    { key: 'kudir', label: 'КУДиР' },
  ] },
  { title: 'Служебное', items: [
    { key: 'trash', label: 'Корзина' },
    { key: 'backups', label: 'Резервные копии', egor: true },
    { key: 'admin', label: 'Администрирование', egor: true },
  ] },
]

const NAV = [
  {
    key: 'dashboard',
    label: 'Главная',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    key: 'orders',
    label: 'Заявки',
    badge: 'newOrders',
    badgeColor: '#7C3AED',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="1" fill="currentColor"/>
        <circle cx="3" cy="12" r="1" fill="currentColor"/>
        <circle cx="3" cy="18" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'tasks',
    label: 'Задачи',
    badge: 'pendingTasks',
    badgeColor: '#D97706',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: 'finance',
    label: 'Финансы',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: 'more',
    label: 'Ещё',
    badge: 'moreBadge',
    badgeColor: '#0E9F6E',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8}>
        <circle cx="5" cy="12" r={a ? 2.4 : 1.8}/><circle cx="12" cy="12" r={a ? 2.4 : 1.8}/><circle cx="19" cy="12" r={a ? 2.4 : 1.8}/>
      </svg>
    ),
  },
]

// Managers get their own reduced set — mirrors Sidebar.jsx's desktop logic,
// which this component doesn't share since it has its own nav list.
const MANAGER_NAV = [
  {
    key: 'my-dashboard',
    label: 'Дашборд',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill={a ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={a ? 0 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    key: 'tasks',
    label: 'Задачи',
    badge: 'pendingTasks',
    badgeColor: '#D97706',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: 'leads',
    label: 'Обзвон',
    badge: 'newLeads',
    badgeColor: '#1366F0',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    ),
  },
]

const ACTIVE_KEYS = {
  'order-detail': 'orders',
}
const MORE_KEYS = new Set(['client-detail', 'carrier-detail', 'fleet-trip-detail', 'fleet-client-detail', 'fleet-order-detail', 'fleet-analytics',
  ...MORE_SECTIONS.flatMap(sec => sec.items.map(i => i.key))])

function MoreSheet({ page, counts, onNav, onClose }) {
  const { user } = useAuth()
  const profile = user?.user || {}
  const isDirector = profile.role === 'director' || profile.role === 'admin'
  const canFleet = isDirector || profile.fleet_access === true
  const isEgor = user?.username === 'egor_dir'
  const sections = MORE_SECTIONS
    .filter(sec => (!sec.director || isDirector) && (!sec.fleet || canFleet))
    .map(sec => ({ ...sec, items: sec.items.filter(i => (!i.director || isDirector) && (!i.egor || isEgor)) }))
    .filter(sec => sec.items.length)
  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title="Разделы" onClose={onClose} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {sections.map(sec => (
          <div key={sec.title}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#A6AEB8', marginBottom: 6 }}>{sec.title}</div>
            <div style={{ borderRadius: 14, background: 'rgba(14,23,38,0.035)', overflow: 'hidden' }}>
              {sec.items.map((it, idx) => {
                const active = page === it.key
                const n = it.badge ? counts?.[it.badge] : 0
                return (
                  <button key={it.key} onClick={() => { onNav(it.key); onClose() }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px', border: 'none',
                      borderTop: idx ? '1px solid rgba(14,23,38,0.06)' : 'none', background: active ? 'rgba(19,102,240,0.08)' : 'transparent',
                      color: active ? '#1366F0' : '#0E1726', fontFamily: 'Manrope', fontSize: 16, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {n > 0 && <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: '#0E9F6E', color: '#fff', fontSize: 11, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>{n > 99 ? '99+' : n}</span>}
                    <span style={{ color: '#C4CAD4', fontSize: 18 }}>›</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </ModalOverlay>
  )
}

export default function MobileNav({ page, onNav, counts, isManager }) {
  const navList = isManager ? MANAGER_NAV : NAV
  const [moreOpen, setMoreOpen] = useState(false)
  const activeKey = !isManager && MORE_KEYS.has(page) ? 'more' : (ACTIVE_KEYS[page] || page)
  const allCounts = { ...counts, moreBadge: (counts?.newReplies || 0) + (counts?.newLeads || 0) }

  // A capsule that glides behind the active icon (Telegram-style tab bar)
  // instead of the icon just swapping color in place. Sized/positioned off
  // the button's own box now that there's no label underneath pulling the
  // icon up — full nav height, centered on the icon.
  const btnRefs = useRef({})
  const [pill, setPill] = useState(null)
  const PILL_SIZE = 44

  useLayoutEffect(() => {
    const el = btnRefs.current[activeKey]
    if (el) setPill({ left: el.offsetLeft + (el.offsetWidth - PILL_SIZE) / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  return (
    <>
    <div className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
      alignItems: 'stretch',
      justifyContent: 'space-around',
      paddingTop: 0,
      paddingBottom: 0,
      height: 'calc(54px + env(safe-area-inset-bottom))',
      paddingInline: 4,
      background: 'rgba(251,251,253,0.94)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderTop: '0.5px solid rgba(0,0,0,0.12)',
    }}>
      {pill && (
        <div style={{
          position: 'absolute', left: pill.left, top: '50%', width: PILL_SIZE, height: PILL_SIZE,
          marginTop: -PILL_SIZE / 2,
          borderRadius: 14, background: 'rgba(19,102,240,0.12)',
          transition: 'left 0.25s var(--ease)', pointerEvents: 'none',
        }} />
      )}
      {navList.map(item => {
        const active = activeKey === item.key
        const badgeVal = item.badge ? allCounts[item.badge] : 0
        const badgeColor = item.badgeColor || '#1366F0'
        return (
          <button
            key={item.key}
            ref={el => { btnRefs.current[item.key] = el }}
            onClick={() => (item.key === 'more' ? setMoreOpen(true) : onNav(item.key))}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              color: active ? '#1366F0' : '#8E8E93',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.1s',
              padding: 0,
            }}
          >
            {/* The little pop of motion the moment a tab becomes active —
                scale bounces past 1 and settles, via a keyframe rather than
                a plain transition so it reads as a jump, not just a resize. */}
            <span style={{
              position: 'relative', display: 'flex',
              animation: active ? 'navIconPop 0.3s var(--ease)' : 'none',
            }}>
              {item.icon(active)}
              {badgeVal > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  minWidth: 15, height: 15, borderRadius: 99,
                  background: badgeColor,
                  border: '1.5px solid rgba(251,251,253,0.94)',
                  color: '#fff', fontSize: 8, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', lineHeight: 1,
                }}>{badgeVal > 99 ? '99+' : badgeVal}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
    {moreOpen && <MoreSheet page={page} counts={allCounts} onNav={onNav} onClose={() => setMoreOpen(false)} />}
    </>
  )
}
