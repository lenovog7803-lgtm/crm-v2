export function Skeleton({ width = '100%', height = 16, radius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #EEF0F3 25%, #F7F8FA 50%, #EEF0F3 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeletonShimmer 1.4s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 18, border: '1px solid rgba(14,23,38,0.06)' }}>
      <Skeleton width="60%" height={14} style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '40%' : '90%'} height={12} style={{ marginBottom: 8 }} />
      ))}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <Skeleton width={36} height={36} radius={10} />
      <div style={{ flex: 1 }}>
        <Skeleton width="50%" height={13} style={{ marginBottom: 6 }} />
        <Skeleton width="30%" height={11} />
      </div>
      <Skeleton width={70} height={16} />
    </div>
  )
}
