import { useState, useEffect } from 'react'
import { getLeadsAnalytics } from '../../api'

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

export default function AnalyticsView() {
  const [period, setPeriod] = useState('month')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

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
    </div>
  )
}
