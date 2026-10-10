import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../motion'

// Площадной график в духе Bklit UI (bklit.com, MIT) — без их зависимостей (TypeScript, Tailwind, visx):
// плавные кривые monotoneX, заливка градиентом до прозрачного, проявление слева направо,
// при наведении — вертикаль, точки на всех сериях и стеклянная подсказка.
// series: [{ key, label, color, values, dashFrom? }] — dashFrom: с какого индекса линия пунктиром (будущее).

// Кривая monotoneX (Fritsch–Carlson, как d3.curveMonotoneX): не «перелетает» выше/ниже точек.
function monotonePath(pts) {
  const n = pts.length
  if (n < 2) return n ? `M${pts[0].x},${pts[0].y}` : ''
  const dx = [], m = []
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / dx[i] }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  t[n - 1] = m[n - 2]
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${pts[i].x + h},${pts[i].y + h * t[i]} ${pts[i + 1].x - h},${pts[i + 1].y - h * t[i + 1]} ${pts[i + 1].x},${pts[i + 1].y}`
  }
  return d
}

const fmtShort = v => {
  const a = Math.abs(v)
  const k = (x, d) => String(+(x).toFixed(d)).replace('.', ',')  // 1,5K, но 2K — без лишнего «,0»
  if (a >= 1e6) return `${k(v / 1e6, 1)}M`
  if (a >= 1e3) return `${k(v / 1e3, 1)}K`
  return String(Math.round(v))
}

// «Красивый» верх шкалы: 1, 2, 2.5, 5 × 10ⁿ — чтобы подписи были круглыми
function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  return [1, 2, 2.5, 5, 10].map(k => k * p).find(c => c >= v)
}

export default function AreaChart({ series, labels, height = 220, unit = 'Br' }) {
  const id = useId().replace(/:/g, '')
  const wrapRef = useRef(null)
  const revealRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState(null)

  // настоящая ширина в пикселях — подписи и линии остаются чёткими, а не растянутыми
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])

  const n = labels.length
  const dataKey = series.map(s => s.values.join(',')).join('|')

  // проявление слева направо при появлении и смене данных
  useEffect(() => {
    const r = revealRef.current
    if (!r || !width || prefersReducedMotion()) return
    r.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1100, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' })
  }, [dataKey, width > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!n) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
  }

  const PL = 44, PR = 44, PT = 12, PB = 26
  const W = Math.max(width, 200), H = height
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)))
  const x = i => PL + (n === 1 ? (W - PL - PR) / 2 : (i / (n - 1)) * (W - PL - PR))
  const y = v => PT + (1 - Math.max(0, v) / max) * (H - PT - PB)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => k * max)
  const xStep = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - PL - PR) / 70))))

  const lines = series.map(s => {
    const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }))
    const line = monotonePath(pts)
    return { ...s, pts, line, area: pts.length ? `${line} L${pts[pts.length - 1].x},${H - PB} L${pts[0].x},${H - PB} Z` : '' }
  })

  const onMove = e => {
    const r = wrapRef.current.getBoundingClientRect()
    const px = e.clientX - r.left
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - PL) / (W - PL - PR)) * (n - 1)))))
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', userSelect: 'none', height }}
      onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>  {/* down — касание на телефоне */}
      {width > 0 && (
        <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            {lines.map(s => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.4" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
            <clipPath id={`${id}-reveal`}>
              <rect ref={revealRef} x={PL} y={0} width={W - PL - PR} height={H} style={{ transformOrigin: `${PL}px 0`, transformBox: 'view-box' }} />
            </clipPath>
          </defs>

          {/* сетка и подписи шкалы с двух сторон, как у Bklit */}
          {ticks.map(v => (
            <g key={v}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="rgba(14,23,38,0.08)" strokeDasharray={v === 0 ? undefined : '3 4'} />
              <text x={PL - 10} y={y(v) + 4} fontSize="11" fill="#A6AEB8" textAnchor="end">{fmtShort(v)}</text>
              <text x={W - PR + 10} y={y(v) + 4} fontSize="11" fill="#A6AEB8">{fmtShort(v)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % xStep === 0 || i === n - 1) && (n - 1 - i >= xStep / 2 || i === n - 1) ? (
            <text key={i} x={x(i)} y={H - 6} fontSize="11" fill="#A6AEB8" textAnchor="middle">{l}</text>
          ) : null)}

          <g clipPath={`url(#${id}-reveal)`}>
            {/* первая серия — главная: рисуется последней (поверх), остальные при наведении уходят в тень */}
            {[...lines].reverse().map(s => {
              const dim = hover !== null && s.key !== lines[0].key ? 0.55 : 1
              const dashAt = s.dashFrom != null && s.dashFrom < n - 1 ? x(s.dashFrom) : null
              return (
                <g key={s.key} style={{ opacity: dim, transition: 'opacity 0.2s' }}>
                  <path d={s.area} fill={`url(#${id}-${s.key})`} />
                  {dashAt == null
                    ? <path d={s.line} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                    : <>
                        <clipPath id={`${id}-${s.key}-solid`}><rect x={0} y={0} width={dashAt} height={H} /></clipPath>
                        <clipPath id={`${id}-${s.key}-dash`}><rect x={dashAt} y={0} width={W} height={H} /></clipPath>
                        <path d={s.line} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" clipPath={`url(#${id}-${s.key}-solid)`} />
                        <path d={s.line} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray="6 4" opacity="0.6" clipPath={`url(#${id}-${s.key}-dash)`} />
                      </>}
                </g>
              )
            })}
          </g>

          {hover !== null && <>
            <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="rgba(14,23,38,0.18)" />
            {lines.map(s => s.pts[hover] && (
              <circle key={s.key} cx={s.pts[hover].x} cy={s.pts[hover].y} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2" />
            ))}
          </>}
        </svg>
      )}

      {hover !== null && (
        // сбоку от вертикали: справа, а у правого края — слева
        <div className="area-tip" style={x(hover) + 196 < W
          ? { left: x(hover) + 12, top: PT }
          : { left: x(hover) - 12, top: PT, transform: 'translateX(-100%)' }}>
          <div className="area-tip-title">{labels[hover]}</div>
          {series.map(s => s.values[hover] !== undefined && (
            <div key={s.key} className="area-tip-row">
              <span className="area-tip-dot" style={{ background: s.color }} />
              <span className="area-tip-label">{s.label}</span>
              <span className="area-tip-val">{Math.round(s.values[hover]).toLocaleString('ru-RU')} {unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
