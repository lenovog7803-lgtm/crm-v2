import { useState } from 'react'
import { RingChart } from '../bklit/charts/ring-chart'
import { Ring } from '../bklit/charts/ring'
import '../bklit/bklit.css'

// «Цели месяца» на кольцевой диаграмме Bklit (bklit.com, MIT): одно кольцо на цель, как «Активность» Apple Watch.
// items: [{ key, label, fact, goal, color, fmt }]; onEdit(key) — открыть изменение плана.
export default function GoalsRings({ items, onEdit, size = 112 }) {
  const [hovered, setHovered] = useState(null)
  // кольцо не может быть длиннее круга — перевыполнение рисуем полным, а цифры пишем настоящие
  const rings = [...items].reverse()  // у Bklit первое кольцо внутреннее — «Прибыль» делаем внешним
  const data = rings.map(g => ({ label: g.label, value: Math.min(g.fact, g.goal || 0), maxValue: g.goal || 1, color: g.color }))
  const pct = g => (g.goal > 0 ? Math.round((g.fact / g.goal) * 100) : 0)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%' }}>
      {/* --border — цвет пустой дорожки кольца у Bklit */}
      <div className="bklit" style={{ position: 'relative', width: size, height: size, flexShrink: 0, '--border': 'rgba(var(--ink-rgb), 0.07)' }}>
        <RingChart data={data} size={size} strokeWidth={Math.round(size / 12)} ringGap={Math.round(size / 36)} baseInnerRadius={size / 2 - 2 - items.length * Math.round(size / 12) - (items.length - 1) * Math.round(size / 36)}
          padding={2} startAngle={0} endAngle={Math.PI * 2} hoveredIndex={hovered === null ? null : items.length - 1 - hovered} onHoverChange={i => setHovered(i === null ? null : items.length - 1 - i)}>
          {data.map((d, i) => <Ring key={d.label} index={i} color={d.color} />)}
        </RingChart>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((g, i) => (
          <button key={g.key} type="button" onClick={() => onEdit(g.key)} title="Изменить план на этот месяц"
            onPointerEnter={() => setHovered(i)} onPointerLeave={() => setHovered(null)}
            className="goal-row" style={{ background: hovered === i ? 'rgba(var(--ink-rgb), 0.04)' : 'transparent' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: g.color, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>{g.label}</span>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.fmt(g.fact)} <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>/ {g.fmt(g.goal)}</span>
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{pct(g)}%</span>
          </button>
        ))}
      </div>
    </div>
  )
}
