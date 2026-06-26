const NAV = [
  {
    key: 'dashboard',
    label: 'Дашборд',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'orders',
    label: 'Заявки',
    badge: 'newOrders',
    badgeColor: '#7C3AED',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
        <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>
      </svg>
    ),
  },
  {
    key: 'tasks',
    label: 'Задачи',
    badge: 'pendingTasks',
    badgeColor: '#D97706',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    key: 'finance',
    label: 'Финансы',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: 'clients',
    label: 'Клиенты',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

const ACTIVE_KEYS = {
  'order-detail': 'orders',
  'client-detail': 'clients',
  'carrier-detail': 'clients',
}

export default function MobileNav({ page, onNav, counts }) {
  const activeKey = ACTIVE_KEYS[page] || page

  return (
    <div className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000,
      alignItems: 'center', justifyContent: 'space-around',
      height: 64,
      paddingBottom: 'env(safe-area-inset-bottom)',
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(28px) saturate(200%)',
      WebkitBackdropFilter: 'blur(28px) saturate(200%)',
      borderTop: '1px solid rgba(255,255,255,0.8)',
      boxShadow: '0 -4px 24px rgba(14,23,38,0.1)',
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
              flex: 1, height: '100%', border: 'none', background: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, position: 'relative',
              color: active ? '#1366F0' : '#8A93A0',
              transition: 'color 0.15s',
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 32, height: 3, borderRadius: '0 0 4px 4px',
                background: '#1366F0',
              }} />
            )}
            <span style={{ position: 'relative' }}>
              {item.icon}
              {badgeVal > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -5,
                  minWidth: 15, height: 15, borderRadius: 99,
                  background: badgeColor, border: '2px solid #fff',
                  color: '#fff', fontSize: 8, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px',
                }}>{badgeVal > 99 ? '99+' : badgeVal}</span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, fontFamily: 'Manrope', letterSpacing: '-0.01em' }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
