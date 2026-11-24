export function EmptyState({ title, subtitle, actionLabel, onAction, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: compact ? '22px 16px' : '48px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: compact ? 14 : 16, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4, maxWidth: 320, lineHeight: 1.45 }}>{subtitle}</div>}
      {actionLabel && (
        <button className="btn-primary" onClick={onAction} style={{ marginTop: 16 }}>{actionLabel}</button>
      )}
    </div>
  )
}
