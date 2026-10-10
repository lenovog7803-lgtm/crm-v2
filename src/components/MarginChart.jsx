import { AreaChart, Area } from '../bklit/charts/area-chart'
import { Grid } from '../bklit/charts/grid'
import { XAxis } from '../bklit/charts/x-axis'
import { YAxis } from '../bklit/charts/y-axis'
import { ChartTooltip } from '../bklit/charts/tooltip'
import '../bklit/bklit.css'

// График маржи на настоящем компоненте Bklit UI (bklit.com/studio, MIT) — как в их Studio:
// две площади с градиентом, сетка, шкала слева и справа, подсказка, анимация 1,1 с (0.85, 0, 0.15, 1).
// dates — Date для каждой точки (день или первое число месяца), current/prev — маржа по точкам.
const money = v => `${Math.round(v).toLocaleString('ru-RU')} Br`
// шкала: 1,2K, а не «1k» дважды подряд
const short = v => v >= 1000 ? `${String(+(v / 1000).toFixed(1)).replace('.', ',')}K` : String(Math.round(v))

export default function MarginChart({ dates, current, prev, height = 230 }) {
  if (!dates.length) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6AEB8', fontSize: 13 }}>Нет данных за период</div>
  }
  const hasPrev = prev?.some(v => v > 0)
  // отрицательная маржа рисуется как 0 — площадь не уходит под ось; в подсказке — настоящее число
  const data = dates.map((date, i) => ({
    date, cur: Math.max(0, current[i] || 0), prev: Math.max(0, prev?.[i] || 0),
    curRaw: current[i] || 0, prevRaw: prev?.[i] || 0,
  }))

  return (
    <div className="bklit" style={{ height }}>
      <AreaChart data={data} animationDuration={1100} animationEasing="cubic-bezier(0.85, 0, 0.15, 1)"
        aspectRatio="auto" margin={{ left: 44, right: 44, top: 12, bottom: 28 }}>
        <Grid horizontal />
        {hasPrev && <Area dataKey="prev" fill="var(--chart-line-secondary)" />}
        <Area dataKey="cur" fill="var(--chart-line-primary)" />
        <YAxis orientation="left" formatValue={short} />
        <YAxis orientation="right" formatValue={short} />
        <XAxis />
        <ChartTooltip
          // точка на кривой — цвета своей кривой (по умолчанию Bklit берёт цвет по порядку строк подсказки)
          dotColor={(_, line) => line.dataKey === 'cur' ? 'var(--chart-line-primary)' : 'var(--chart-line-secondary)'}
          rows={p => [
          { color: 'var(--chart-line-primary)', label: 'Этот период', value: money(p.curRaw) },
          ...(hasPrev ? [{ color: 'var(--chart-line-secondary)', label: 'Прошлый период', value: money(p.prevRaw) }] : []),
        ]} />
      </AreaChart>
    </div>
  )
}
