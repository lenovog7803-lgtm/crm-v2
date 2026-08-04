import { useState, useEffect } from 'react'
import { getLeadsAnalytics, getCallsByDay } from '../../api'

const PERIODS = [
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'all', label: 'Всё время' },
]

const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0))

function StatCard({ label, value, color = '#0E1726' }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 26, color }}>{value}</div>
    </div>
  )
}

function CallsHeatmap({ data, onDayClick }) {
  const max = Math.max(...data.map(d => d.calls), 1)
  const colorFor = (n) => {
    if (n === 0) return '#F0F1F4'
    const t = n / max
    if (t < 0.25) return '#CFE0FF'
    if (t < 0.5) return '#8FB6FF'
    if (t < 0.75) return '#4C8CFF'
    return '#1366F0'
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Активность обзвона</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 16px)', gap: 4 }}>
        {data.map((d) => (
          <div
            key={d.date}
            onClick={() => onDayClick(d.date)}
            title={`${d.date}: ${d.calls} звонков`}
            style={{ width: 16, height: 16, borderRadius: 4, background: colorFor(d.calls), cursor: 'pointer' }}
          />
        ))}
        {data.length === 0 && <div style={{ fontSize: 12.5, color: '#A6AEB8' }}>Нет данных за период</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 11, color: '#8A93A0' }}>
        меньше
        {['#F0F1F4', '#CFE0FF', '#8FB6FF', '#4C8CFF', '#1366F0'].map(c => (
          <div key={c} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
        ))}
        больше
      </div>
    </div>
  )
}

function DayCallsModal({ date, onClose }) {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getCallsByDay(date).then(r => setCalls(r.calls || [])).catch(console.error).finally(() => setLoading(false))
  }, [date])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 520, padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 17, color: '#0E1726' }}>
            Звонки за {new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(14,23,38,0.1)', background: '#F7F8FA', cursor: 'pointer', fontSize: 18, color: '#8A93A0', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#8A93A0', marginBottom: 16 }}>{loading ? 'Загрузка…' : `${calls.length} звонков`}</div>
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          {!loading && calls.length === 0 && (
            <div style={{ fontSize: 12.5, color: '#A6AEB8', textAlign: 'center', padding: 20 }}>Звонков в этот день не было</div>
          )}
          {calls.map((c, i) => (
            <div key={c.id || i} style={{ padding: '9px 0', borderBottom: '1px solid #F0F1F4' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0E1726' }}>{c.lead_name}</div>
              <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 2 }}>
                {c.outcome} · {new Date(c.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                {c.comment ? ` · ${c.comment}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsView() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [heatmapDay, setHeatmapDay] = useState(null)

  useEffect(() => {
    setLoading(true)
    getLeadsAnalytics(period).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [period])

  if (loading || !data) return <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка отчётов…</div>

  const days = data.calls_by_day || []
  const maxCalls = Math.max(data.daily_goal, ...days.map(d => d.calls), 1)
  const avgPerDay = days.length ? Math.round(data.total_calls / days.length) : 0
  const daysGoalMet = days.filter(d => d.calls >= data.daily_goal).length

  const maxLostCount = Math.max(1, ...(data.lost_reasons || []).map(r => r.count))
  const totalLost = (data.lost_reasons || []).reduce((s, r) => s + r.count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card" style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600,
            background: period === p.id ? '#0E1726' : 'rgba(14,23,38,0.06)',
            color: period === p.id ? '#fff' : '#5A6573',
          }}>{p.label}</button>
        ))}
      </div>

      {/* 1. Звонки против плана */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 4 }}>Звонки против плана</div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12.5, color: '#5A6573' }}>Всего звонков: <b style={{ color: '#0E1726' }}>{data.total_calls}</b></div>
          <div style={{ fontSize: 12.5, color: '#5A6573' }}>Среднее в день: <b style={{ color: '#0E1726' }}>{avgPerDay}</b></div>
          <div style={{ fontSize: 12.5, color: '#5A6573' }}>Дней с выполненным планом: <b style={{ color: '#1E9E5A' }}>{daysGoalMet}</b> из {days.length}</div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, paddingTop: 10 }}>
          <div style={{
            position: 'absolute', left: 0, right: 0,
            bottom: `${(data.daily_goal / maxCalls) * 140}px`,
            borderTop: '1.5px dashed rgba(217,119,6,0.6)',
          }} />
          {days.map(d => {
            const h = Math.max(2, (d.calls / maxCalls) * 140)
            const met = d.calls >= data.daily_goal
            return (
              <div key={d.date} title={`${d.date}: ${d.calls}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', maxWidth: 26, height: h, borderRadius: 6, background: met ? '#1E9E5A' : '#1366F0' }} />
                <span style={{ fontSize: 9, color: '#A6AEB8' }}>{d.date.slice(5)}</span>
              </div>
            )
          })}
          {days.length === 0 && <div style={{ fontSize: 12.5, color: '#A6AEB8' }}>Нет данных за период</div>}
        </div>
      </div>

      <CallsHeatmap data={days} onDayClick={setHeatmapDay} />

      {/* 2. Воронка конверсий */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Воронка конверсий</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(data.funnel || []).map((f, i) => {
            const width = data.funnel[0] ? Math.max(4, (f.cumulative / (data.funnel[0].cumulative || 1)) * 100) : 0
            const troubled = i > 0 && f.conversion < 30
            return (
              <div key={f.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: '#5A6573', fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontSize: 12, color: troubled ? '#D97706' : '#5A6573' }}>
                    {f.count} · {f.cumulative} лидов {i > 0 && `· ${f.conversion}%`}
                  </span>
                </div>
                <div style={{ height: 14, borderRadius: 8, background: 'rgba(14,23,38,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: 8, width: `${width}%`, background: troubled ? '#D97706' : f.color, transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 3. Причины отказов */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Причины отказов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.lost_reasons || []).map(r => (
              <div key={r.reason}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: '#5A6573' }}>{r.reason}</span>
                  <span style={{ fontSize: 12, color: '#A6AEB8' }}>{r.count} · {totalLost ? Math.round(r.count / totalLost * 100) : 0}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 6, background: 'rgba(14,23,38,0.06)' }}>
                  <div style={{ height: '100%', borderRadius: 6, width: `${(r.count / maxLostCount) * 100}%`, background: '#E0473B' }} />
                </div>
              </div>
            ))}
            {(!data.lost_reasons || data.lost_reasons.length === 0) && <div style={{ fontSize: 12.5, color: '#A6AEB8' }}>Отказов не было</div>}
          </div>
        </div>

        {/* 5. Отдача от холодных лидов */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
          <StatCard label="Лидов → клиентов" value={fmt(data.cold_leads?.converted_count)} color="#1E9E5A" />
          <StatCard label="Заявок от них" value={fmt(data.cold_leads?.orders_count)} color="#1366F0" />
          <StatCard label="Выручка, BYN" value={fmt(data.cold_leads?.revenue)} />
          <StatCard label="Маржа, BYN" value={fmt(data.cold_leads?.margin)} color="#7C3AED" />
        </div>
      </div>

      {/* 4. Конверсия по отраслям */}
      <div className="card" style={{ padding: 20, overflow: 'auto' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Конверсия по отраслям</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Отрасль', 'Всего', 'Обзвонено', 'Клиентов', 'Отказов', 'Конверсия'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.by_industry || []).map((row, i) => (
              <tr key={row.industry} style={{ background: i < 3 ? 'rgba(30,158,90,0.06)' : undefined }}>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.industry}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.total}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.called}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.won}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.lost}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: i < 3 ? '#1E9E5A' : '#0E1726', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{row.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!data.by_industry || data.by_industry.length === 0) && <div style={{ padding: 20, textAlign: 'center', color: '#A6AEB8' }}>Нет данных</div>}
      </div>

      {heatmapDay && <DayCallsModal date={heatmapDay} onClose={() => setHeatmapDay(null)} />}
    </div>
  )
}
