import { useState, useEffect } from 'react'
import { getMyDashboard } from '../api'
import { CountUp } from '../components/CountUp'
import LeaderboardView from '../components/leads/LeaderboardView'
import ErrorBoundary from '../components/ErrorBoundary'

const MONTH_RU_SHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
const fmtMonth = m => {
  const [y, mo] = m.split('-')
  return `${MONTH_RU_SHORT[parseInt(mo) - 1]} ${y}`
}

function StatCard({ label, value, color = '#0E1726', format }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: 22, color }}>
        <CountUp value={value} format={format} />
      </div>
    </div>
  )
}

export default function ManagerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    setError('')
    getMyDashboard().then(setData).catch(e => setError(e.message || 'Ошибка загрузки')).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>
  if (error) return (
    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: '#C81923', marginBottom: 12 }}>Не удалось загрузить дашборд: {error}</div>
      <button onClick={load} className="btn-primary" style={{ margin: '0 auto' }}>Попробовать снова</button>
    </div>
  )
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Нет данных</div>

  const monthly = data.monthly || []
  const maxCalls = Math.max(1, ...monthly.map(m => m.calls))
  const currentMonth = monthly[monthly.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <StatCard label="ЗВОНКОВ ЗА ВСЁ ВРЕМЯ" value={data.total_calls} color="#1366F0" />
        <StatCard
          label="ЛУЧШИЙ МЕСЯЦ"
          value={data.best_month?.calls || 0}
          color="#D97706"
          format={v => data.best_month ? `${fmtMonth(data.best_month.month)} · ${Math.round(v)} звонков` : '—'}
        />
        <StatCard label="СТАЛО КЛИЕНТАМИ ЗА ВСЁ ВРЕМЯ" value={data.total_won} color="#1E9E5A" />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 4 }}>Звонки по месяцам</div>
        <div style={{ fontSize: 12.5, color: '#5A6573', marginBottom: 16 }}>
          В этом месяце: <b style={{ color: '#0E1726' }}>{currentMonth?.calls || 0}</b> звонков, <b style={{ color: '#1E9E5A' }}>{currentMonth?.won || 0}</b> в клиенты
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
          {monthly.map(m => {
            const h = Math.max(4, (m.calls / maxCalls) * 130)
            const isBest = data.best_month && m.month === data.best_month.month
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10.5, color: '#5A6573', fontWeight: 600 }}>{m.calls}</div>
                <div style={{ width: '100%', maxWidth: 36, height: h, borderRadius: 8, background: isBest ? '#D97706' : '#1366F0', transition: 'height 0.4s' }} />
                <span style={{ fontSize: 10.5, color: '#A6AEB8' }}>{fmtMonth(m.month)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <ErrorBoundary><LeaderboardView /></ErrorBoundary>
    </div>
  )
}
