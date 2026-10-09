import { ThinkingOrb } from 'thinking-orbs'

// Спокойный пустой экран: «дышащая» сфера + что здесь будет и что сделать.
export function EmptyState({ title, subtitle, actionLabel, onAction, compact = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: compact ? '22px 16px' : '48px 24px', textAlign: 'center' }}>
      <div style={{ width: compact ? 64 : 88, height: compact ? 64 : 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(19,102,240,0.08) 0%, rgba(19,102,240,0) 70%)' }}>
        <ThinkingOrb state="breathing" size={64} theme="light" style={{ transform: `scale(${compact ? 0.85 : 1.15})`, opacity: 0.75 }} aria-label={title} />
      </div>
      <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: compact ? 14 : 16, letterSpacing: '-0.01em', color: '#0E1726', marginTop: compact ? 8 : 14 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: '#8A93A0', marginTop: 4, maxWidth: 320, lineHeight: 1.45 }}>{subtitle}</div>}
      {actionLabel && (
        <button className="btn-primary" onClick={onAction} style={{ marginTop: 16 }}>{actionLabel}</button>
      )}
    </div>
  )
}
