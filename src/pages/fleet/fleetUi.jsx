// Кнопки-действия в стиле карточки заявки экспедирования (OrderDetail).
const VARIANTS = {
  edit: { bg: 'rgba(19,102,240,0.08)', color: '#1366F0' },
  neutral: { bg: 'rgba(14,23,38,0.06)', color: '#5A6573' },
  delete: { bg: 'rgba(200,25,35,0.1)', color: '#C81923' },
  green: { bg: 'rgba(30,158,90,0.1)', color: '#1E9E5A' },
}

const I = (p) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
const ICONS = {
  edit: I(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></>),
  dup: I(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  delete: I(<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /></>),
  back: I(<polyline points="15 18 9 12 15 6" />),
  plus: I(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
}

export function PillBtn({ variant = 'neutral', icon, onClick, disabled, style, children }) {
  const v = VARIANTS[variant] || VARIANTS.neutral
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 16px', borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
      flexShrink: 0, background: v.bg, color: v.color, fontFamily: 'Manrope', fontWeight: 600, fontSize: 13,
      display: 'inline-flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.6 : 1, ...style,
    }}>
      {icon && ICONS[icon]}{children}
    </button>
  )
}
