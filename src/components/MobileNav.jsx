import { useRef, useState, useLayoutEffect } from 'react'
import { useAuth } from '../AuthContext'
import { ModalOverlay, useSheet } from './Modal'
import { PopNumber } from './Transitions'

// Нижняя панель на телефоне — не больше 5 вкладок (как в iOS); всё остальное — в «Ещё».
// «Ещё» оформлено как «Настройки» iPhone: серый фон, белые скруглённые группы,
// цветные иконки-квадратики, системный шрифт, «Готово» справа.
const g = (d) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)
const ICONS = {
  tasks: g(<><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>),
  money: g(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  clients: g(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></>),
  carriers: g(<><rect x="1" y="4" width="14" height="12" rx="1"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/></>),
  leads: g(<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>),
  mailing: g(<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></>),
  fleet: g(<><path d="M5 17H3V6a1 1 0 0 1 1-1h10v12"/><path d="M14 9h4l3 4v4h-2"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/></>),
  dashboard: g(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>),
  route: g(<><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h8"/></>),
  reports: g(<><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></>),
  book: g(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>),
  trash: g(<><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></>),
  backup: g(<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/></>),
  shield: g(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>),
}
const MORE_SECTIONS = [
  { title: 'Работа', items: [
    { key: 'tasks', label: 'Задачи', icon: 'tasks', color: '#FF9500', badge: 'pendingTasks' },
    { key: 'finance', label: 'Финансы', icon: 'money', color: '#34C759' },
    { key: 'leads', label: 'База обзвона', icon: 'leads', color: '#007AFF', badge: 'newLeads' },
    { key: 'mailing', label: 'Рассылка', icon: 'mailing', color: '#5856D6', badge: 'newReplies', director: true },
  ] },
  { title: 'Свой автопарк', fleet: true, items: [
    { key: 'fleet-dashboard', label: 'Дашборд автопарка', icon: 'dashboard', color: '#30B0C7' },
    { key: 'fleet-trips', label: 'Рейсы', icon: 'route', color: '#30B0C7' },
    { key: 'fleet-clients', label: 'Клиенты автопарка', icon: 'clients', color: '#30B0C7' },
    { key: 'fleet-vehicles', label: 'Машины и водители', icon: 'fleet', color: '#30B0C7' },
  ] },
  { title: 'Отчёты и учёт', director: true, items: [
    { key: 'reports', label: 'Отчёты', icon: 'reports', color: '#AF52DE' },
    { key: 'kudir', label: 'КУДиР', icon: 'book', color: '#A2845E' },
  ] },
  { title: 'Служебное', items: [
    { key: 'trash', label: 'Корзина', icon: 'trash', color: '#8E8E93' },
    { key: 'backups', label: 'Резервные копии', icon: 'backup', color: '#636366', egor: true },
    { key: 'admin', label: 'Администрирование', icon: 'shield', color: '#FF3B30', egor: true },
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
    key: 'clients',
    label: 'Клиенты',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    key: 'carriers',
    label: 'Перевозчики',
    icon: (a) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
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
  'client-detail': 'clients',
  'carrier-detail': 'carriers',
}
const MORE_KEYS = new Set(['fleet-trip-detail', 'fleet-client-detail', 'fleet-order-detail', 'fleet-analytics',
  ...MORE_SECTIONS.flatMap(sec => sec.items.map(i => i.key))])

const SYS_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'

function SheetDone({ onClose }) {
  const sheet = useSheet()
  return (
    <button onClick={() => (sheet ? sheet.requestClose() : onClose())}
      style={{ position: 'absolute', right: 0, top: 0, border: 'none', background: 'none', padding: '4px 4px 4px 12px',
        color: '#007AFF', fontFamily: SYS_FONT, fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>
      Готово
    </button>
  )
}

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
    <ModalOverlay onClose={onClose}
      panelStyle={{ background: '#F2F2F7', fontFamily: SYS_FONT, maxHeight: '92dvh', overflowY: 'auto' }}
      bodyStyle={{ padding: '18px 0 8px' }}>
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 18, minHeight: 26 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: '#000', letterSpacing: '-0.01em' }}>Разделы</span>
        <SheetDone onClose={onClose} />
      </div>
      {sections.map(sec => (
        <div key={sec.title} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: '#6D6D72', textTransform: 'uppercase', letterSpacing: '0.02em', padding: '0 16px 7px' }}>{sec.title}</div>
          <div style={{ borderRadius: 12, background: '#FFFFFF', overflow: 'hidden' }}>
            {sec.items.map((it, idx) => {
              const active = page === it.key
              const n = it.badge ? counts?.[it.badge] : 0
              return (
                <button key={it.key} className="ios-row" onClick={() => { onNav(it.key); onClose() }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, padding: '0 14px 0 14px',
                    border: 'none', background: '#FFFFFF', fontFamily: SYS_FONT, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 7, background: it.color, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ICONS[it.icon]}</span>
                  {/* разделитель начинается от текста, а не от края — как в iOS */}
                  <span style={{ flex: 1, alignSelf: 'stretch', display: 'flex', alignItems: 'center', gap: 8,
                    borderTop: idx ? '0.5px solid rgba(60,60,67,0.29)' : 'none' }}>
                    <span style={{ flex: 1, fontSize: 17, color: '#000', fontWeight: active ? 600 : 400, letterSpacing: '-0.02em' }}>{it.label}</span>
                    {n > 0 && <span style={{ minWidth: 22, height: 22, borderRadius: 11, background: '#FF3B30', color: '#fff', fontSize: 13, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px' }}>{n > 99 ? '99+' : n}</span>}
                    {active && <span style={{ color: '#007AFF', fontSize: 15, fontWeight: 600 }}>✓</span>}
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#C4C4C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l6 6-6 6"/></svg>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
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
                }}><PopNumber value={badgeVal > 99 ? '99+' : badgeVal} /></span>
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
