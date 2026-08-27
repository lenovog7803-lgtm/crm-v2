import { useState, useEffect, useCallback } from 'react'
import { getReports, runReport } from '../api'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import BotSubscribeSection from '../components/BotSubscribeSection'
import { fmtMoney } from '../utils'

const TABS = [
  { key: 'daily', label: 'Ежедневные' },
  { key: 'weekly', label: 'Еженедельные' },
  { key: 'monthly', label: 'Ежемесячные' },
]

const PERIOD_LABEL = { daily: 'за сегодня', weekly: 'за неделю', monthly: 'за месяц' }

const money = v => fmtMoney(Math.round(Number(v) || 0))
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')

function fmtStamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Same stat-tile pattern as the dashboard KPI grid — label + big number on a
// tinted background.
function Stat({ label, value, color = '#0E1726', bg = 'rgba(14,23,38,0.06)', sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{
        fontFamily: 'Onest', fontWeight: 800, fontSize: 24, color,
        background: bg, borderRadius: 12, padding: '8px 14px', display: 'inline-block', lineHeight: 1,
      }}>{value}</div>
      {sub != null && <div style={{ fontSize: 11.5, color: '#8A93A0', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function LegList({ title, items }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#8A93A0' }}>нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((x, i) => (
            <div key={i} style={{
              padding: '7px 0', borderBottom: i < items.length - 1 ? '1px solid #F0F1F4' : 'none',
              fontSize: 13, color: '#0E1726',
            }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: '#1366F0', marginRight: 8 }}>
                {x.order_number || '—'}
              </span>
              {[x.route_from, x.route_to].filter(Boolean).join(' → ')}
              {(x.client_name || x.carrier_name) && (
                <span style={{ color: '#8A93A0' }}>
                  {' · '}
                  {x.client_name && `клиент ${x.client_name}`}
                  {x.client_name && x.carrier_name && ', '}
                  {x.carrier_name && `перевозчик ${x.carrier_name}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportCard({ r }) {
  const topClients = Array.isArray(r.top_clients) ? r.top_clients : []
  const loads = Array.isArray(r.tomorrow_loads) ? r.tomorrow_loads : []
  const unloads = Array.isArray(r.tomorrow_unloads) ? r.tomorrow_unloads : []
  const hasTomorrow = r.tomorrow_date != null && (loads.length || unloads.length || r.period === 'daily')
  return (
    <div className="card" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>
          Отчёт {PERIOD_LABEL[r.period] || r.period}
        </div>
        <div style={{ fontSize: 12, color: '#A6AEB8' }}>{fmtStamp(r.generated_at)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
        <Stat label="Выручка" value={money(r.revenue)} color="#1366F0" bg="rgba(19,102,240,0.08)"
          sub={r.orders_count != null ? `${int(r.orders_count)} заявок` : null} />
        <Stat label="Маржа" value={money(r.margin)} color="#1E9E5A" bg="rgba(30,158,90,0.08)" />
        <Stat label="Доставлено" value={int(r.delivered)} color="#1E9E5A" bg="rgba(30,158,90,0.08)" />
        <Stat label="Просрочка перевозчикам" value={int(r.overdue_carrier_count)} color="#E0473B" bg="rgba(224,71,59,0.08)"
          sub={money(r.overdue_carrier_sum)} />
        <Stat label="Должники (клиенты)" value={int(r.debtors_count)} color="#D97706" bg="rgba(217,119,6,0.08)"
          sub={money(r.debtors_sum)} />
        <Stat label="Звонки" value={int(r.calls_total)} color="#7C3AED" bg="rgba(124,58,237,0.08)"
          sub={`стали клиентами: ${int(r.calls_won)}`} />
      </div>

      {hasTomorrow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #F0F1F4', paddingTop: 14 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 13, color: '#0E1726' }}>
            Завтра{r.tomorrow_date ? ` (${r.tomorrow_date})` : ''}
          </div>
          <LegList title="Загрузки" items={loads} />
          <LegList title="Выгрузки" items={unloads} />
        </div>
      )}

      {topClients.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 8 }}>Топ клиентов</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topClients.map(([name, sum], i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '7px 0', borderBottom: i < topClients.length - 1 ? '1px solid #F0F1F4' : 'none',
                fontSize: 13, color: '#0E1726',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#A6AEB8', marginRight: 8 }}>{i + 1}</span>{name}
                </span>
                <span style={{ fontWeight: 600, flexShrink: 0 }}>{money(sum)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const { show } = useToast()
  const [tab, setTab] = useState('daily')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getReports(tab)
      .then(r => setReports(r.reports || []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }, [tab, show])

  useEffect(() => { load() }, [load])

  const runNow = async () => {
    setRunning(true)
    try {
      await runReport(tab)
      show('Отчёт сформирован и отправлен в Telegram', { type: 'success' })
      load()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setRunning(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Onest', fontSize: 20, fontWeight: 800, color: '#0E1726', margin: 0 }}>Отчёты</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SlidingTabs options={TABS} value={tab} onChange={setTab} />
          <button
            onClick={runNow}
            disabled={running}
            style={{ padding: '7px 15px', borderRadius: 99, border: 'none', cursor: running ? 'default' : 'pointer', fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600, background: '#0E1726', color: '#fff', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {running ? '…' : 'Сформировать сейчас'}
          </button>
        </div>
      </div>

      <BotSubscribeSection />

      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Загрузка…</div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
          Отчётов пока нет. Они формируются автоматически в 21:00 по Минску (ежедневный — каждый день, еженедельный — в пятницу, ежемесячный — в последний день месяца)
          либо по кнопке «Сформировать сейчас».
        </div>
      ) : (
        reports.map(r => <ReportCard key={r.id || r.generated_at} r={r} />)
      )}
    </div>
  )
}
