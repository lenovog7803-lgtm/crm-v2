// Simple line-art illustration + optional call-to-action — replaces a bare
// "Нет заявок" text line. The mark reuses the app's brand blue/navy so it
// doesn't look like a bolted-on stock illustration.
function EmptyIllustration() {
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" fill="none">
      <circle cx="44" cy="44" r="44" fill="#1366F0" fillOpacity="0.06" />
      <rect x="24" y="30" width="40" height="32" rx="6" fill="#fff" stroke="#C7D6F5" strokeWidth="2" />
      <line x1="24" y1="40" x2="64" y2="40" stroke="#C7D6F5" strokeWidth="2" />
      <line x1="32" y1="48" x2="52" y2="48" stroke="#DCE4F2" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="54" x2="44" y2="54" stroke="#DCE4F2" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="62" cy="26" r="10" fill="#1366F0" />
      <path d="M62 21v10M57 26h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <EmptyIllustration />
      <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726', marginTop: 16 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: '#A6AEB8', marginTop: 4, maxWidth: 280 }}>{subtitle}</div>}
      {actionLabel && (
        <button className="btn-primary" onClick={onAction} style={{ marginTop: 18 }}>{actionLabel}</button>
      )}
    </div>
  )
}
