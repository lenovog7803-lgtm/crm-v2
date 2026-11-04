import { useState } from 'react'
import { PieChart } from '../bklit/charts/pie-chart'
import { PieSlice } from '../bklit/charts/pie-slice'
import { PieCenter } from '../bklit/charts/pie-center'
import '../bklit/bklit.css'

// Доли выручки клиентов — кольцевая диаграмма Bklit (bklit.com, MIT). slices: [{ label, value, color }].
const money = v => `${Math.round(v).toLocaleString('ru-RU')}`

export default function ClientsPie({ slices, size = 150 }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div className="bklit clients-pie" style={{ width: size, height: size, margin: '0 auto 12px' }}>
      <PieChart data={slices} size={size} innerRadius={size / 2 - 16} padAngle={0.02} cornerRadius={4}
        hoveredIndex={hovered} onHoverChange={setHovered}>
        {slices.map((s, i) => <PieSlice key={s.label} index={i} color={s.color} />)}
        <PieCenter defaultLabel="выручка, BYN">
          {({ value, label, isHovered }) => (
            <div style={{ textAlign: 'center', lineHeight: 1.15, padding: '0 6px' }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{money(value)}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, maxWidth: size - 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isHovered ? label : 'выручка, BYN'}
              </div>
            </div>
          )}
        </PieCenter>
      </PieChart>
    </div>
  )
}
