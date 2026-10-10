import { useEffect, useLayoutEffect, useRef } from 'react'
import { prefersReducedMotion } from '../motion'

// «Капля» выбора (переключатели, меню) на пружине: при новом выборе едет с текущего места и
// с текущей скоростью — быстрые повторные нажатия перенаправляют её, а не начинают заново.
// Растяжение берётся из скорости: чем быстрее летит, тем сильнее вытянута, на месте — круглая.
// pos/size — куда и какого размера (px вдоль оси), key — что выбрано: смена key — анимация,
// смена pos при том же key в покое (ресайз, раскрытие меню) — мгновенно, а в полёте — перенацеливает
// (позиция нового пункта часто приходит рендером позже смены key). Элемент стоит в left/top: 0.
const DAMPING = 0.78, RESPONSE = 0.32  // лёгкий перелёт — капля «пружинит» на месте
const K = Math.pow((2 * Math.PI) / RESPONSE, 2), C = (4 * Math.PI * DAMPING) / RESPONSE

export function useSpringPill(ref, pos, size, key, axis = 'x') {
  const s = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || pos == null) return
    const draw = (p, w, v) => {
      const k = Math.min(Math.abs(v) / 2400, 0.35)
      el.style.transform = axis === 'x'
        ? `translate3d(${p}px,0,0) scale(${1 + k},${1 - k * 0.45})`
        : `translate3d(0,${p}px,0) scale(${1 - k * 0.3},${1 + k})`
      el.style[axis === 'x' ? 'width' : 'height'] = `${w}px`
    }
    const st = s.current
    if (!st || (st.key === key && !st.running) || prefersReducedMotion()) {
      if (st) cancelAnimationFrame(st.raf)
      s.current = { p: pos, w: size, v: 0, vw: 0, key, raf: 0, running: false }
      draw(pos, size, 0)
      return
    }
    st.key = key
    st.running = true
    cancelAnimationFrame(st.raf)
    let last = performance.now()
    const step = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30) / 4
      last = now
      for (let i = 0; i < 4; i++) {  // мелкие шаги — устойчиво при резкой пружине
        st.v += (-K * (st.p - pos) - C * st.v) * dt; st.p += st.v * dt
        st.vw += (-K * (st.w - size) - C * st.vw) * dt; st.w += st.vw * dt
      }
      if (Math.abs(st.p - pos) < 0.3 && Math.abs(st.v) < 5 && Math.abs(st.w - size) < 0.3) {
        Object.assign(st, { p: pos, w: size, v: 0, vw: 0, running: false })
        draw(pos, size, 0)
        return
      }
      draw(st.p, st.w, st.v)
      st.raf = requestAnimationFrame(step)
    }
    st.raf = requestAnimationFrame(step)
  }, [pos, size, key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(s.current?.raf), [])
}
