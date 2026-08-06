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

const STATUS_LABEL = { new: 'Новая', in_progress: 'В работе', done: 'Доставлено', cancelled: 'Отменено' }

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
  const maxMargin = Math.max(1, ...monthly.map(m => Math.abs(m.margin)))
  const currentMonth = monthly[monthly.length - 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <StatCard
          label="МАРЖА ЗА ВСЁ ВРЕМЯ"
          value={data.total_margin}
          color="#1E9E5A"
          format={v => `${Math.round(v).toLocaleString('ru-RU')} BYN`}
        />
        <StatCard
          label="ЛУЧШИЙ МЕСЯЦ"
          value={data.best_month?.margin || 0}
          color="#D97706"
          format={v => data.best_month ? `${fmtMonth(data.best_month.month)} · ${Math.round(v).toLocaleString('ru-RU')} BYN` : '—'}
        />
        <StatCard label="ЗВОНКОВ В ЭТОМ МЕСЯЦЕ" value={currentMonth?.calls || 0} color="#1366F0" />
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 16 }}>Маржа по месяцам</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
          {monthly.map(m => {
            const h = Math.max(4, (Math.abs(m.margin) / maxMargin) * 130)
            const isBest = data.best_month && m.month === data.best_month.month
            return (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 10.5, color: '#5A6573', fontWeight: 600 }}>{Math.round(m.margin).toLocaleString('ru-RU')}</div>
                <div style={{ width: '100%', maxWidth: 36, height: h, borderRadius: 8, background: isBest ? '#D97706' : '#1366F0', transition: 'height 0.4s' }} />
                <span style={{ fontSize: 10.5, color: '#A6AEB8' }}>{fmtMonth(m.month)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <ErrorBoundary><LeaderboardView /></ErrorBoundary>

      <div className="card" style={{ padding: 20, overflow: 'auto' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 14 }}>Мои заявки и маржа</div>
        {data.orders.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#A6AEB8' }}>Пока нет заявок</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Заявка', 'Дата загрузки', 'Статус', 'Маржа'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.orders.map(o => (
                <tr key={o.order_number}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontFamily: 'JetBrains Mono', color: '#1366F0', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{o.order_number}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{o.load_date || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, borderTop: '1px solid rgba(14,23,38,0.05)' }}>{STATUS_LABEL[o.status] || o.status}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: o.margin < 0 ? '#C81923' : '#1E9E5A', borderTop: '1px solid rgba(14,23,38,0.05)' }}>{o.margin.toLocaleString('ru-RU')} BYN</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
