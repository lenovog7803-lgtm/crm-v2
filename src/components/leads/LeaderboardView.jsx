import { useState, useEffect } from 'react'
import { getLeaderboard } from '../../api'
import { useAuth } from '../../AuthContext'
import { Loader } from '../Loader'

const PERIODS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
]

const MEDAL = ['🥇', '🥈', '🥉']

export default function LeaderboardView() {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [period, setPeriod] = useState('today')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getLeaderboard(period).then(r => setRows(r.leaderboard || [])).catch(console.error).finally(() => setLoading(false))
  }, [period])

  const maxCalls = Math.max(1, ...rows.map(r => r.calls))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: '10px 12px', display: 'flex', gap: 6, width: 'fit-content' }}>
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            padding: '7px 16px', borderRadius: 99, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sys)', fontSize: 12.5, fontWeight: 600,
            background: period === p.id ? '#0E1726' : 'rgba(var(--ink-rgb), 0.06)',
            color: period === p.id ? '#fff' : 'var(--text-secondary)',
          }}>{p.label}</button>
        ))}
      </div>

      {loading ? (
        <Loader padding={40} state="composing" />
      ) : rows.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Пока нет менеджеров для рейтинга</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const isMe = r.id === myId
            const barWidth = Math.max(3, (r.calls / maxCalls) * 100)
            return (
              <div key={r.id} className="card" style={{
                padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
                border: isMe ? '1.5px solid rgba(19,102,240,0.4)' : undefined,
                background: isMe ? 'rgba(19,102,240,0.04)' : undefined,
              }}>
                <div style={{ width: 32, textAlign: 'center', fontSize: i < 3 ? 22 : 15, fontWeight: 800, color: i < 3 ? undefined : 'var(--text-tertiary)', flexShrink: 0 }}>
                  {MEDAL[i] || i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{r.name}</span>
                    {isMe && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#1366F0', background: 'rgba(19,102,240,0.1)', padding: '2px 8px', borderRadius: 20 }}>ЭТО ВЫ</span>}
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(var(--ink-rgb), 0.06)', marginTop: 8, maxWidth: 300 }}>
                    <div style={{ height: '100%', borderRadius: 99, width: `${barWidth}%`, background: i === 0 ? '#D97706' : '#1366F0', transition: 'width 0.4s' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 22, flexShrink: 0, textAlign: 'right' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{r.calls}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>звонков</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 18, color: '#1E9E5A' }}>{r.won}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>в клиенты</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>{r.conversion}%</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>конверсия</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
