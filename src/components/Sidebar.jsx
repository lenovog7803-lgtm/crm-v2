import React, { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../AuthContext'
import { initials } from '../utils'
import { SlidingTabs } from './SlidingTabs'
import { mouseOnly, haptic, rubberband } from '../motion'
import { useSpringPill } from '../hooks/useSpringPill'
import { PopNumber } from './Transitions'

const HIDDEN_MENU_WIDTH = 200

const NAV = [
  {
    key: 'dashboard',
    label: 'Дашборд',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )
  },
  {
    key: 'orders',
    label: 'Заявки',
    badge: 'newOrders',
    badgeColor: '#7C3AED',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/>
        <line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="1" fill="currentColor"/>
        <circle cx="3" cy="12" r="1" fill="currentColor"/>
        <circle cx="3" cy="18" r="1" fill="currentColor"/>
      </svg>
    )
  },
  {
    key: 'finance',
    label: 'Финансы',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    )
  },
  {
    key: 'plan',
    label: 'План',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="12" cy="12" r="1" fill="currentColor"/>
      </svg>
    )
  },
  {
    key: 'tasks',
    label: 'Задачи',
    badge: 'pendingTasks',
    badgeColor: '#D97706',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    )
  },
  {
    key: 'clients',
    label: 'Клиенты',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    key: 'carriers',
    label: 'Перевозчики',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1"/>
        <path d="M16 8h4l3 3v5h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    )
  },
  {
    key: 'leads',
    label: 'База обзвона',
    badge: 'newLeads',
    badgeColor: '#1366F0',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 9.7 19.79 19.79 0 0 1 1.63 1.06 2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.08 6.08l.96-.96a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    )
  },  {
    key: 'mailing',
    label: 'Рассылка',
    badge: 'newReplies',
    badgeColor: '#0E9F6E',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2"/>
        <path d="m22 7-10 6L2 7"/>
      </svg>
    )
  },
]

// «Свой автопарк» — параллельный набор пунктов, тот же сайдбар. Показывается
// только директору / аккаунту с fleet_access, переключается тумблером внизу.
const truckIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/>
    <path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
)
const FLEET_NAV = [
  {
    key: 'fleet-dashboard', label: 'Дашборд',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    )
  },
  { key: 'fleet-trips', label: 'Рейсы', icon: truckIcon },
  {
    key: 'fleet-plan', label: 'План',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
      </svg>
    )
  },
  {
    key: 'fleet-clients', label: 'Клиенты',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    )
  },
  {
    key: 'fleet-vehicles', label: 'Машины и водители',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/>
        <path d="M9 17h6"/>
        <circle cx="17" cy="17" r="2"/>
      </svg>
    )
  },
]

// Managers only work leads and tasks — everything else (finance, clients,
// carriers, admin) stays director-only until per-manager scoping exists for
// those sections too. The business dashboard is director-only too (it's
// company-wide financials) — managers get their own below instead.
const MANAGER_NAV_KEYS = ['tasks', 'leads']

const MANAGER_DASHBOARD_ITEM = {
  key: 'my-dashboard',
  label: 'Дашборд',
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

// Not shown in the regular nav — reachable only via a long-press on the
// profile avatar. Admin/Backups stay egor_dir-only (his own call); KUDiR
// opens to any director account, gated by role rather than username since
// both director logins need to reach the accounting journal.
const HIDDEN_NAV = [
  {
    key: 'admin',
    label: 'Администрирование',
    egorOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    )
  },
  {
    key: 'backups',
    label: 'Резервные копии',
    egorOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    )
  },
  {
    key: 'kudir',
    label: 'КУДиР',
    directorOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    )
  },
  {
    key: 'reports',
    label: 'Отчёты',
    directorOnly: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    )
  },
]

function roleLabel(role, position) {
  if (position) return position
  const map = { admin: 'Администратор', director: 'Директор', manager: 'Менеджер' }
  return map[role] || role || 'Менеджер'
}

export default function Sidebar({ page, expanded, onNav, onToggle, counts, onSignOut }) {
  const { user } = useAuth()
  const profile = user?.user || {}
  const userName = profile.name || 'Пользователь'
  const userRole = roleLabel(profile.role, profile.position)
  const userInitials = initials(userName)
  const isEgorDir = user?.username === 'egor_dir'
  const isDirectorRole = profile.role === 'director' || profile.role === 'admin'
  const canFleet = isDirectorRole || profile.fleet_access === true

  // Режим сайдбара: экспедирование / свой автопарк. Тумблер виден только
  // тем, у кого есть доступ к автопарку; остальным сайдбар — как был.
  const [mode, setMode] = useState(() => {
    try { return canFleet && localStorage.getItem('crm_mode') === 'fleet' ? 'fleet' : 'forwarding' }
    catch { return 'forwarding' }
  })
  useEffect(() => {
    try { localStorage.setItem('crm_mode', mode) } catch { /* private mode */ }
  }, [mode])

  const switchMode = (next) => {
    if (next === mode) return
    setMode(next)
    onNav(next === 'fleet' ? 'fleet-trips' : 'dashboard')
  }

  const baseNavItems = profile.role === 'manager'
    ? [MANAGER_DASHBOARD_ITEM, ...NAV.filter(item => MANAGER_NAV_KEYS.includes(item.key))]
    : (canFleet && mode === 'fleet') ? FLEET_NAV : NAV

  // ---- Свой порядок пунктов меню: зажать и перетащить (как иконки в iOS) ----
  const orderKey = `crm_nav_order:${user?.username || 'me'}:${profile.role === 'manager' ? 'manager' : mode}`
  const [navOrder, setNavOrder] = useState(() => { try { return JSON.parse(localStorage.getItem(orderKey)) || [] } catch { return [] } })
  useEffect(() => { try { setNavOrder(JSON.parse(localStorage.getItem(orderKey)) || []) } catch { setNavOrder([]) } }, [orderKey])
  const navItems = [...baseNavItems].sort((a, b) => {
    const ia = navOrder.indexOf(a.key), ib = navOrder.indexOf(b.key)
    return (ia < 0 ? 999 + baseNavItems.indexOf(a) : ia) - (ib < 0 ? 999 + baseNavItems.indexOf(b) : ib)
  })
  const [drag, setDrag] = useState(null)          // { key, from, over, dy, stride, dropping }
  const press = useRef(null)                      // { key, y, timer, pointerId, el }
  const suppressClick = useRef(false)

  const beginDrag = (p) => {
    const stride = (p.el?.offsetHeight || 44) + 4
    setDrag({ key: p.key, from: navItems.findIndex(i => i.key === p.key), over: navItems.findIndex(i => i.key === p.key), dy: 0, stride, startY: p.y })
    try { p.el?.setPointerCapture(p.pointerId) } catch { /* уже отпущено */ }
    haptic(12)
  }
  const navPointerDown = (item) => (e) => {
    if (e.button !== 0) return
    const p = { key: item.key, y: e.clientY, pointerId: e.pointerId, el: e.currentTarget, mouse: e.pointerType === 'mouse' }
    press.current = p
    // палец — долгое нажатие (как в iOS); мышь — достаточно потянуть
    if (!p.mouse) p.timer = setTimeout(() => { if (press.current === p) beginDrag(p) }, 380)
  }
  const navPointerMove = (e) => {
    const p = press.current
    if (!p) return
    if (!drag) {
      if (Math.abs(e.clientY - p.y) > 6) {
        if (p.mouse) beginDrag(p)
        else { clearTimeout(p.timer); press.current = null }  // палец поехал до долгого нажатия — это прокрутка
      }
      return
    }
    const raw = e.clientY - drag.startY
    const min = -drag.from * drag.stride, max = (navItems.length - 1 - drag.from) * drag.stride
    // за краями — резиновое сопротивление, как в iOS
    const dy = raw < min ? min + rubberband(raw - min, 120) : raw > max ? max + rubberband(raw - max, 120) : raw
    const over = Math.max(0, Math.min(navItems.length - 1, drag.from + Math.round(dy / drag.stride)))
    if (over !== drag.over) haptic(6)
    setDrag(d => ({ ...d, dy, over }))
  }
  const navPointerUp = () => {
    const p = press.current
    press.current = null
    if (p?.timer) clearTimeout(p.timer)
    if (!drag) return
    suppressClick.current = true
    setTimeout(() => { suppressClick.current = false }, 50)
    const { from, over, stride } = drag
    // пункт пружиной доезжает до нового места, потом фиксируем порядок
    setDrag(d => ({ ...d, dy: (over - from) * stride, dropping: true }))
    setTimeout(() => {
      if (over !== from) {
        const keys = navItems.map(i => i.key)
        const [k] = keys.splice(from, 1)
        keys.splice(over, 0, k)
        setNavOrder(keys)
        try { localStorage.setItem(orderKey, JSON.stringify(keys)) } catch { /* приватный режим */ }
      }
      setDrag(null)
    }, 220)
  }
  const dragStyle = (index, key) => {
    if (!drag) return {}
    if (key === drag.key) {
      return { transform: `translateY(${drag.dy}px) scale(${drag.dropping ? 1 : 1.04})`, zIndex: 5,
        boxShadow: drag.dropping ? 'none' : '0 12px 28px -8px rgba(14,23,38,0.35)', background: 'rgba(255,255,255,0.96)',
        transition: drag.dropping ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms' : 'box-shadow 160ms, background 160ms', cursor: 'grabbing' }
    }
    const { from, over, stride } = drag
    const shift = from < over && index > from && index <= over ? -stride : from > over && index >= over && index < from ? stride : 0
    return { transform: `translateY(${shift}px)`, transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)' }
  }

  const [hiddenMenuOpen, setHiddenMenuOpen] = useState(false)
  const longPressTimer = useRef(null)
  const avatarRef = useRef(null)
  const [hiddenMenuPos, setHiddenMenuPos] = useState({ left: 0, bottom: 0 })

  // Sliding active-item indicator — a single pill that glides to the active
  // nav button instead of each button just toggling its own fill, so
  // switching sections reads as continuous motion rather than a hard cut.
  const navButtonRefs = useRef({})
  const [pillRect, setPillRect] = useState(null)
  const pillRef = useRef(null)
  const activeKey = navItems.find(item =>
    page === item.key ||
    (item.key === 'orders' && page === 'order-detail') ||
    (item.key === 'clients' && page === 'client-detail') ||
    (item.key === 'carriers' && page === 'carrier-detail') ||
    (item.key === 'fleet-trips' && (page === 'fleet-trip-detail' || page === 'fleet-order-detail')) ||
    (item.key === 'fleet-clients' && page === 'fleet-client-detail') ||
    (item.key === 'fleet-dashboard' && page === 'fleet-analytics')
  )?.key

  useLayoutEffect(() => {
    const el = navButtonRefs.current[activeKey]
    if (el) setPillRect({ top: el.offsetTop, height: el.offsetHeight })
  }, [activeKey, expanded, navOrder.join(',')])
  useSpringPill(pillRef, pillRect?.top, pillRect?.height, activeKey, 'y')

  const isDirector = profile.role === 'director' || profile.role === 'admin'

  const startLongPress = () => {
    // Egor's own call for admin/backups; any director account can reach the
    // menu too, since KUDiR needs to be open to both director logins.
    if (!isEgorDir && !isDirector) return
    // Only reachable with the sidebar expanded — collapsed, the avatar sits
    // too close to the screen edge for a 200px popup to sit near it without
    // overlapping content awkwardly either way.
    if (!expanded) return
    longPressTimer.current = setTimeout(() => {
      const sidebarRect = avatarRef.current?.closest('.desktop-sidebar')?.getBoundingClientRect()
      const avatarRect = avatarRef.current?.getBoundingClientRect()
      if (sidebarRect && avatarRect) {
        setHiddenMenuPos({
          left: sidebarRect.left + sidebarRect.width / 2,
          bottom: window.innerHeight - avatarRect.top + 8,
        })
      }
      setHiddenMenuOpen(true)
    }, 550)
  }
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  return (
    <aside className="desktop-sidebar liquid-glass" style={{
      width: expanded ? 240 : 68,
      minWidth: expanded ? 240 : 68,
      transition: 'width 0.2s ease, min-width 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(255,255,255,0.55)',
      backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 22,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 40px -22px rgba(20,30,55,0.2)',
      padding: '16px 12px',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingLeft: 2 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <img
            src="/logo-mark.svg"
            alt="AV2"
            style={{ height: 30, objectFit: 'contain' }}
          />
        </div>
        {expanded && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 15, color: '#0E1726', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>А2 Group</div>
          </div>
        )}
        {expanded && (
          <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A6AEB8', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
      </div>

      {!expanded && (
        <button onClick={onToggle} style={{
          background: 'none', border: 'none', cursor: 'pointer', color: '#A6AEB8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '6px 0', marginBottom: 8,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
        {pillRect && (
          <div ref={pillRef} style={{
            position: 'absolute', left: 0, right: 0, top: 0,  // место и высоту ставит пружина (useSpringPill)
            borderRadius: 12, background: 'rgba(19,102,240,0.1)',  // тонированная заливка без тени — как выделение в боковой панели iPad/Mac
            opacity: drag ? 0 : 1,  // во время перетаскивания подсветка не мешает
            transition: 'opacity 0.15s',
            pointerEvents: 'none', zIndex: 0,
          }} />
        )}
        {navItems.map((item, index) => {
          const active = item.key === activeKey
          const badgeVal = item.badge ? counts[item.badge] : null
          const badgeColor = item.badgeColor || '#1366F0'
          return (
            <button
              key={item.key}
              ref={el => { navButtonRefs.current[item.key] = el }}
              onClick={() => { if (!suppressClick.current) onNav(item.key) }}
              onPointerDown={navPointerDown(item)}
              onPointerMove={navPointerMove}
              onPointerUp={navPointerUp}
              onPointerCancel={navPointerUp}
              onContextMenu={e => { if (drag || press.current) e.preventDefault() }}
              title={expanded ? 'Зажмите и перетащите, чтобы поменять порядок' : item.label}
              className={active ? 'sidebar-nav-btn active' : 'sidebar-nav-btn'}
              style={{
                height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
                justifyContent: expanded ? 'flex-start' : 'center',
                color: active ? '#1366F0' : '#5A6573',
                fontFamily: 'var(--font-sys)', fontWeight: 600, fontSize: 13.5,
                whiteSpace: 'nowrap',
                position: 'relative', zIndex: 1, textAlign: 'left',
                touchAction: drag ? 'none' : 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
                ...dragStyle(index, item.key),
              }}
            >
              <span style={{
                flexShrink: 0, width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: active ? 'navIconPop 0.3s var(--ease)' : 'none',
              }}>{item.icon}</span>
              {expanded && <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>}
              {expanded && badgeVal > 0 && (
                <span className="t-badge-pop" style={{
                  background: badgeColor, color: '#fff', borderRadius: 99,
                  padding: '2px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}><PopNumber value={badgeVal > 99 ? '99+' : badgeVal} /></span>
              )}
              {!expanded && badgeVal > 0 && (
                <span className="t-badge-pop" style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 8, height: 8, borderRadius: '50%',
                  background: badgeColor,
                }} />
              )}
            </button>
          )
        })}
      </nav>

      {/* Переключатель режима — только для директора / аккаунта с fleet_access */}
      {canFleet && expanded && (
        <div style={{ paddingTop: 12, borderTop: '1px solid rgba(14,23,38,0.08)', marginBottom: 12 }}>
          <SlidingTabs
            options={[{ key: 'forwarding', label: 'Экспедиция' }, { key: 'fleet', label: 'Автопарк' }]}
            value={mode}
            onChange={switchMode}
            fontSize={12}
          />
        </div>
      )}
      {canFleet && !expanded && (
        <button
          onClick={() => switchMode(mode === 'fleet' ? 'forwarding' : 'fleet')}
          title={mode === 'fleet' ? 'К экспедированию' : 'К автопарку'}
          style={{
            marginBottom: 10, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: mode === 'fleet' ? 'rgba(19,102,240,0.1)' : 'rgba(14,23,38,0.05)',
            color: mode === 'fleet' ? '#1366F0' : '#5A6573',
          }}
        >
          {truckIcon}
        </button>
      )}

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12,
        borderTop: '1px solid rgba(14,23,38,0.08)', paddingLeft: 2,
      }}>
        <div
          ref={avatarRef}
          className="no-callout"
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onPointerLeave={mouseOnly(cancelLongPress)}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #A5D8FF 0%, #1366F0 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
          }}
        >{userInitials}</div>
        {expanded && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
              <div style={{ fontSize: 11, color: '#A6AEB8' }}>{userRole}</div>
            </div>
            <button onClick={onSignOut} title="Выйти" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A6AEB8', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {hiddenMenuOpen && createPortal(
        // Portalled to <body> — the sidebar itself has backdropFilter, which
        // makes it a containing block for position:fixed descendants, so a
        // fixed-position popup rendered inside it was positioning relative
        // to the (narrow, overflow:hidden) sidebar box instead of the
        // viewport and getting clipped when the sidebar was collapsed.
        <div onClick={() => setHiddenMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: hiddenMenuPos.left, bottom: hiddenMenuPos.bottom, transform: 'translateX(-50%)',
              width: HIDDEN_MENU_WIDTH, borderRadius: 16, padding: 8,
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.7)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 14px 40px -22px rgba(20,30,55,0.35)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#A6AEB8', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '6px 10px 4px' }}>
              Скрытые функции
            </div>
            {HIDDEN_NAV.filter(item => (item.egorOnly ? isEgorDir : true) && (item.directorOnly ? isDirector : true)).map(item => (
              <button
                key={item.key}
                onClick={() => { onNav(item.key); setHiddenMenuOpen(false) }}
                style={{
                  width: '100%', height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
                  background: page === item.key ? 'rgba(19,102,240,0.1)' : 'transparent',
                  color: page === item.key ? '#1366F0' : '#5A6573',
                  fontFamily: 'var(--font-sys)', fontWeight: 600, fontSize: 13,
                }}
                onPointerEnter={mouseOnly(e => { if (page !== item.key) e.currentTarget.style.background = 'rgba(14,23,38,0.05)' })}
                onPointerLeave={mouseOnly(e => { if (page !== item.key) e.currentTarget.style.background = 'transparent' })}
              >
                <span style={{ flexShrink: 0, width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </aside>
  )
}
