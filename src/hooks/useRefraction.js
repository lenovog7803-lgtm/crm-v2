import { useEffect } from 'react'
import { prefersReducedMotion } from '../motion'

// Преломление как у стекла iOS 26: фон под стеклом изгибается у краёв, будто через линзу.
// Карта смещений (feDisplacementMap) строится под размер элемента и подключается через backdrop-filter.
// Работает только в Chromium (Chrome, Edge) — Safari/Firefox не умеют SVG-фильтры в backdrop-filter,
// там остаётся обычное размытое стекло (.liquid-glass).

const isChromium = () => typeof navigator !== 'undefined' && !!navigator.userAgentData?.brands?.some(b => /Chromium/.test(b.brand))
const SVG_NS = 'http://www.w3.org/2000/svg'
let uid = 0

function hostSvg() {
  let svg = document.getElementById('lg-refract-defs')
  if (!svg) {
    svg = document.createElementNS(SVG_NS, 'svg')
    svg.id = 'lg-refract-defs'
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.appendChild(document.createElementNS(SVG_NS, 'defs'))
    document.body.appendChild(svg)
  }
  return svg.firstChild
}

// Карта смещений для скруглённого прямоугольника: внутри края шириной bezel фон «тянется» внутрь
// (как у выпуклой линзы), в середине — без искажений. R — смещение по X, G — по Y, 128 = ноль.
export function displacementMap(w, h, radius, bezel) {
  const k = 0.5  // карта в половинном разрешении — фон всё равно размыт, разницы не видно
  const W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k))
  const r = Math.min(radius, w / 2, h / 2)
  const sdf = (x, y) => {  // расстояние до края (внутри — отрицательное)
    const qx = Math.abs(x - w / 2) - (w / 2 - r), qy = Math.abs(y - h / 2) - (h / 2 - r)
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  }
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5) / k, y = (j + 0.5) / k
      const d = -sdf(x, y)  // глубина от края внутрь
      let dx = 0, dy = 0
      if (d > 0 && d < bezel) {
        const t = 1 - d / bezel
        const mag = t * t  // сильнее всего у самого края, плавно к нулю внутри
        const nx = sdf(x + 1, y) - sdf(x - 1, y), ny = sdf(x, y + 1) - sdf(x, y - 1)
        const len = Math.hypot(nx, ny) || 1
        dx = -(nx / len) * mag; dy = -(ny / len) * mag  // наружная нормаль → берём фон ближе к центру
      }
      const o = (j * W + i) * 4
      img.data[o] = 128 + dx * 127
      img.data[o + 1] = 128 + dy * 127
      img.data[o + 2] = 128
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas.toDataURL()
}

export function useRefraction(ref, { radius = 22, bezel = 26, scale = 46, blur = 14 } = {}) {
  useEffect(() => {
    const el = ref.current
    if (!el || !isChromium() || prefersReducedMotion()) return
    const id = `lg-refract-${++uid}`
    const defs = hostSvg()
    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.id = id
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0'); filter.setAttribute('width', '1'); filter.setAttribute('height', '1')
    filter.setAttribute('color-interpolation-filters', 'sRGB')
    const fimg = document.createElementNS(SVG_NS, 'feImage')
    fimg.setAttribute('result', 'map'); fimg.setAttribute('preserveAspectRatio', 'none')
    const disp = document.createElementNS(SVG_NS, 'feDisplacementMap')
    disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 'map')
    disp.setAttribute('scale', String(scale))
    disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G')
    filter.append(fimg, disp)
    defs.appendChild(filter)

    let last = ''
    const build = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight)
      if (!w || !h || `${w}x${h}` === last) return
      last = `${w}x${h}`
      fimg.setAttribute('width', String(w)); fimg.setAttribute('height', String(h))
      fimg.setAttribute('href', displacementMap(w, h, radius, bezel))
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)
    el.style.setProperty('--lg-filter', `url(#${id}) blur(${blur}px) saturate(190%) brightness(1.04)`)
    el.classList.add('lg-refract')
    return () => {
      ro.disconnect()
      filter.remove()
      el.classList.remove('lg-refract')
      el.style.removeProperty('--lg-filter')
    }
  }, [ref, radius, bezel, scale, blur])
}
