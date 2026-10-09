import { useState, useEffect } from 'react'
import { getFleetAnalytics } from '../../api'
import { useToast } from '../../components/Toast'
import { CountUp } from '../../components/CountUp'
import { PillBtn } from './fleetUi'
import { Loader } from '../../components/Loader'
import DateInput from '../../components/DateInput'

const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')
const MONTHS_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const mLabel = m => { const [y, mo] = String(m).split('-'); return `${MONTHS_RU[+mo - 1] || mo} ${String(y).slice(2)}` }

// Помесячная прибыль — столбики (синий прибыль / красный убыток).
function ProfitChart({ rows }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: 12, color: '#A6AEB8' }}>Нет данных за период</div>
  const max = Math.max(1, ...rows.map(r => Math.abs(r.profit)))
  const W = Math.max(320, rows.length * 56)
  const H = 160
  const bw = W / rows.length * 0.5
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H + 28} style={{ display: 'block' }}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#E8EAEE" strokeWidth="1" />
        {rows.map((r, i) => {
          const cx = (i + 0.5) * (W / rows.length)
          const h = (Math.abs(r.profit) / max) * (H / 2 - 8)
          const pos = r.profit >= 0
          return (
            <g key={r.month}>
              <rect x={cx - bw / 2} y={pos ? H / 2 - h : H / 2} width={bw} height={Math.max(2, h)} rx="3"
                fill={pos ? '#1366F0' : '#E0473B'} />
              <text x={cx} y={pos ? H / 2 - h - 5 : H / 2 + h + 13} textAnchor="middle"
                fontSize="10" fontFamily="ui-monospace, Menlo, monospace" fill={pos ? '#1366F0' : '#E0473B'}>{int(r.profit)}</text>
              <text x={cx} y={H + 18} textAnchor="middle" fontSize="10.5" fill="#8A93A0">{mLabel(r.month)}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function PnlTable({ title, rows, cols }) {
  return (
    <div className="card" style={{ padding: '18px 20px', overflow: 'hidden' }}>
      <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 12 }}>{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#A6AEB8' }}>
              {cols.map(c => <th key={c.key} style={{ padding: '8px 10px', fontWeight: 600, textAlign: c.right ? 'right' : 'left' }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} style={{ padding: 16, textAlign: 'center', color: '#A6AEB8' }}>Нет данных</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: '1px solid #F0F1F4' }}>
                {cols.map(c => (
                  <td key={c.key} style={{
                    padding: '9px 10px', textAlign: c.right ? 'right' : 'left',
                    fontFamily: c.mono ? 'var(--font-mono)' : 'inherit',
                    fontWeight: c.bold ? 700 : 400,
                    color: c.color ? c.color(r[c.key]) : '#0E1726',
                  }}>{c.fmt ? c.fmt(r[c.key], r) : r[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FleetAnalytics({ onBack }) {
  const { show } = useToast()
  const [d, setD] = useState(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    const p = {}
    if (from) p.date_from = from
    if (to) p.date_to = to
    getFleetAnalytics(p).then(setD).catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
  }, [from, to, show])

  if (!d) return <Loader padding={20} state="composing" />

  const inp = { height: 38, padding: '0 12px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.14)', background: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-sys)', fontSize: 13, color: '#0E1726' }
  const profitColor = v => (Number(v) >= 0 ? '#1E9E5A' : '#E0473B')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <PillBtn variant="neutral" icon="back" onClick={onBack}>Дашборд</PillBtn>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 22, color: '#0E1726' }}>Аналитика автопарка</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>{d.trips_total} рейсов · {int(d.total_km)} км</div>
        </div>
        <DateInput type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
        <span style={{ color: '#A6AEB8' }}>—</span>
        <DateInput type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Порожний пробег', v: `${(d.empty_km_pct || 0).toFixed(1)}%`, c: '#D97706' },
          { label: 'Гружёный пробег', v: `${int(d.laden_km)} км`, c: '#1E9E5A' },
          { label: 'Всего пробег', v: `${int(d.total_km)} км`, c: '#1366F0' },
          { label: 'Убыточных рейсов', v: (d.loss_trips || []).length, c: '#E0473B' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 24, color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* График по месяцам */}
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 12 }}>Прибыль по месяцам</div>
        <ProfitChart rows={d.by_month || []} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <PnlTable
          title="P&L по машинам"
          rows={d.by_vehicle || []}
          cols={[
            { key: 'name', label: 'Машина' },
            { key: 'trips', label: 'Рейсы', right: true },
            { key: 'revenue', label: 'Выручка', right: true, mono: true, fmt: int },
            { key: 'expenses', label: 'Расходы', right: true, mono: true, fmt: int, color: () => '#E0473B' },
            { key: 'profit', label: 'Прибыль', right: true, mono: true, bold: true, fmt: int, color: profitColor },
          ]}
        />
        <PnlTable
          title="P&L по водителям"
          rows={d.by_driver || []}
          cols={[
            { key: 'name', label: 'Водитель' },
            { key: 'trips', label: 'Рейсы', right: true },
            { key: 'salary', label: 'ЗП', right: true, mono: true, fmt: int, color: () => '#D97706' },
            { key: 'revenue', label: 'Выручка', right: true, mono: true, fmt: int },
            { key: 'profit', label: 'Прибыль', right: true, mono: true, bold: true, fmt: int, color: profitColor },
          ]}
        />
      </div>

      <PnlTable
        title="Самые убыточные рейсы"
        rows={d.loss_trips || []}
        cols={[
          { key: 'trip_number', label: 'Рейс', fmt: v => `Р${v}`, color: () => '#1366F0', mono: true },
          { key: 'name', label: 'Название' },
          { key: 'route', label: 'Маршрут' },
          { key: 'revenue', label: 'Выручка', right: true, mono: true, fmt: int },
          { key: 'expenses', label: 'Расходы', right: true, mono: true, fmt: int, color: () => '#E0473B' },
          { key: 'profit', label: 'Убыток', right: true, mono: true, bold: true, fmt: int, color: profitColor },
        ]}
      />
    </div>
  )
}
