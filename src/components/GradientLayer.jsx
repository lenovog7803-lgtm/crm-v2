import { lazy, Suspense, useState } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { prefersReducedMotion } from '../motion'

const GradientBackground = lazy(() => import('./GradientBackground'))

const hasWebGL = () => {
  try { return !!document.createElement('canvas').getContext('webgl2') } catch { return false }
}

// Слой живого градиента под всем интерфейсом. Телефон, «уменьшить движение» и браузеры без WebGL —
// остаётся обычный светлый фон (aurora), чтобы не садить батарею и не дёргать вестибулярку.
export default function GradientLayer() {
  const isMobile = useIsMobile()
  const [ok] = useState(() => !prefersReducedMotion() && hasWebGL())
  if (isMobile || !ok) return null
  return (
    <div className="gradient-layer" aria-hidden="true">
      <Suspense fallback={null}><GradientBackground /></Suspense>
    </div>
  )
}
