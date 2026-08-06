import { useEffect, useState } from 'react'

const PARTICLE_COUNT = 14
const COLORS = ['#1366F0', '#1E9E5A', '#7C3AED', '#D97706']

export function CelebrationBurst({ trigger, onDone }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (!trigger) return
    const items = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.4
      const dist = 60 + Math.random() * 50
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: COLORS[i % COLORS.length],
        size: 5 + Math.random() * 4,
        delay: Math.random() * 60,
      }
    })
    setParticles(items)
    const t = setTimeout(() => {
      setParticles([])
      onDone?.()
    }, 900)
    return () => clearTimeout(t)
  }, [trigger])

  if (!particles.length) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'relative', width: 0, height: 0 }}>
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              width: p.size, height: p.size,
              borderRadius: '50%',
              background: p.color,
              left: 0, top: 0,
              animation: `burstFly 0.75s cubic-bezier(0.2, 0.8, 0.3, 1) ${p.delay}ms forwards`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            }}
          />
        ))}
        <div style={{
          position: 'absolute', left: -28, top: -28,
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(19,102,240,0.15)',
          animation: 'burstRing 0.6s ease-out forwards',
        }} />
      </div>
      <style>{`
        @keyframes burstFly {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes burstRing {
          0%   { transform: scale(0.3); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
