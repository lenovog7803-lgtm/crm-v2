// Физика движения в духе iOS (WWDC «Designing Fluid Interfaces») без сторонних библиотек:
// пружина с передачей скорости пальца, проекция «броска» по инерции, резиновые границы.

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// Hover-эффекты только для мыши: на телефоне касание вызывает mouseenter, а mouseleave
// приходит лишь при касании в другом месте — подсветка «залипает». pointerType отсекает это.
export const mouseOnly = (fn) => (e) => { if (e.pointerType === 'mouse') fn(e) }

// Короткий вибро-отклик в значимый момент (Android; iOS Safari вибрацию не поддерживает).
export const haptic = (ms = 10) => { try { navigator.vibrate?.(ms) } catch { /* нет поддержки */ } }

// Куда «долетит» элемент после броска со скоростью v (px/s) — формула из примеров Apple.
// d≈0.998 — как прокрутка, 0.99 — короче и резче.
export const project = (v, d = 0.998) => (v / 1000) * d / (1 - d)

// Сопротивление за границей: чем дальше тянешь, тем меньше элемент следует за пальцем.
export const rubberband = (overshoot, dimension, c = 0.55) =>
  (overshoot * dimension * c) / (dimension + c * Math.abs(overshoot))

// Скорость по последним ~100 мс движения (а не по одному последнему событию — оно шумное).
export function velocityTracker() {
  let pts = []
  return {
    add(v, t = performance.now()) {
      pts.push({ v, t })
      pts = pts.filter(p => t - p.t < 100)
    },
    velocity() {
      if (pts.length < 2) return 0
      const a = pts[0], b = pts[pts.length - 1]
      const dt = (b.t - a.t) / 1000
      return dt > 0 ? (b.v - a.v) / dt : 0
    },
    reset() { pts = [] },
  }
}

// Пружина в терминах Apple: damping 1 — без перелёта, <1 — с отскоком; response — «скорость» (с).
// Стартует с текущего значения и скорости — поэтому её можно перехватить в любой момент.
// Возвращает stop(). Уменьшенное движение — сразу в конечную точку.
export function spring({ from, to, velocity = 0, damping = 1, response = 0.35, onUpdate, onDone }) {
  if (prefersReducedMotion()) {
    onUpdate(to)
    onDone?.()
    return () => {}
  }
  const k = Math.pow((2 * Math.PI) / response, 2)
  const c = (4 * Math.PI * damping) / response
  let x = from, v = velocity, last = performance.now(), raf = 0, stopped = false
  const step = (now) => {
    if (stopped) return
    let dt = Math.min((now - last) / 1000, 1 / 30)
    last = now
    // несколько мелких шагов на кадр — стабильно даже при резкой пружине
    for (let i = 0; i < 4; i++) {
      const h = dt / 4
      const a = -k * (x - to) - c * v
      v += a * h
      x += v * h
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 5) {
      onUpdate(to)
      onDone?.()
      return
    }
    onUpdate(x)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return () => { stopped = true; cancelAnimationFrame(raf) }
}
