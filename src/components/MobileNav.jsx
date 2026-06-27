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
]

const ACTIVE_KEYS = {
  'order-detail': 'orders',
  'client-detail': 'clients',
  'carrier-detail': 'carriers',
  'carriers': 'carriers',
}

export default function MobileNav({ page, onNav, counts }) {
  const activeKey = ACTIVE_KEYS[page] || page

  return (
    <div className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingTop: 8,
      paddingBottom: 0,
      height: 'calc(58px + env(safe-area-inset-bottom))',
      paddingInline: 4,
      background: 'rgba(251,251,253,0.94)',
      backdropFilter: 'blur(40px) saturate(180%)',
      WebkitBackdropFilter: 'blur(40px) saturate(180%)',
      borderTop: '0.5px solid rgba(0,0,0,0.12)',
    }}>
      {NAV.map(item => {
        const active = activeKey === item.key
        const badgeVal = item.badge ? counts?.[item.badge] : 0
        const badgeColor = item.badgeColor || '#1366F0'
        return (
          <button
            key={item.key}
            onClick={() => onNav(item.key)}
            style={{
              flex: 1,
              height: 50,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              position: 'relative',
              color: active ? '#1366F0' : '#8E8E93',
              WebkitTapHighlightColor: 'transparent',
              transition: 'color 0.1s',
              padding: '0 2px',
            }}
          >
            <span style={{ position: 'relative', display: 'flex', transform: 'scale(0.85)', transformOrigin: 'center' }}>
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
            <span style={{
              fontSize: 9,
              fontWeight: active ? 600 : 400,
              fontFamily: 'Manrope',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
