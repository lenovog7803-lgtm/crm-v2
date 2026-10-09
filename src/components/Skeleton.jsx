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
    <div className="ios-widget" style={{ padding: 20 }}>
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

// Заглушка для списков в стиле iOS (клиенты, перевозчики, лиды, задачи) — та же форма, что и строки.
// check — вместо аватара круглая отметка, как в задачах.
export function SkeletonList({ rows = 8, check = false }) {
  return (
    <div className={`ios-list${check ? ' ios-list--check' : ''}`} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ios-row ios-row-skel">
          <Skeleton width={check ? 24 : 42} height={check ? 24 : 42} radius={999} style={{ flexShrink: 0 }} />
          <div className="ios-row-text">
            <Skeleton width={`${46 + (i * 17) % 30}%`} height={14} style={{ marginBottom: 7 }} />
            <Skeleton width={`${28 + (i * 23) % 34}%`} height={11} />
          </div>
          {!check && <Skeleton width={8} height={13} radius={4} style={{ flexShrink: 0 }} />}
        </div>
      ))}
    </div>
  )
}
