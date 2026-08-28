import { useState, useEffect, useCallback } from 'react'
import { getReports, runReport, runMorningBriefing, getBotPrivate, setBotPrivate, getBotSubscription } from '../api'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import { fmtMoney } from '../utils'

const TABS = [
  { key: 'daily', label: 'Ежедневные' },
  { key: 'weekly', label: 'Еженедельные' },
  { key: 'monthly', label: 'Ежемесячные' },
  { key: 'quarterly', label: 'Квартальные' },
  { key: 'yearly', label: 'Годовые' },
]

const PERIOD_LABEL = {
  daily: 'за день', weekly: 'за неделю', monthly: 'за месяц',
  quarterly: 'за квартал', yearly: 'за год',
}

const money = v => fmtMoney(Math.round(Number(v) || 0))
const int = v => Math.round(Number(v) || 0).toLocaleString('ru-RU')

function ddmmyyyy(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return String(iso).slice(0, 10)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtStamp(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function rowTitle(r) {
  const date = ddmmyyyy(r.generated_at)
  return r.period === 'daily' ? `Отчёт за ${date}` : `Отчёт ${PERIOD_LABEL[r.period] || r.period} · ${date}`
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

function ReportBody({ r }) {
  const topClients = Array.isArray(r.top_clients) ? r.top_clients : []
  const loads = Array.isArray(r.tomorrow_loads) ? r.tomorrow_loads : []
  const unloads = Array.isArray(r.tomorrow_unloads) ? r.tomorrow_unloads : []
  const hasTomorrow = r.tomorrow_date != null && (loads.length || unloads.length || r.period === 'daily')
  const total = int(r.orders_count)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '18px 20px 20px' }}>
      <div style={{ fontSize: 12, color: '#A6AEB8' }}>Сформирован: {fmtStamp(r.generated_at)}</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
        <Stat label="Выручка" value={money(r.revenue)} color="#1366F0" bg="rgba(19,102,240,0.08)"
          sub={r.basis === 'unload' ? 'по дате выгрузки' : 'по дате создания заявок'} />
        <Stat label="Маржа" value={money(r.margin)} color="#1E9E5A" bg="rgba(30,158,90,0.08)"
          sub={r.avg_margin != null ? `в среднем ${money(r.avg_margin)}/заявка` : null} />
        <Stat label="Прибыль" value={money(r.net_profit)} color="#1E9E5A" bg="rgba(30,158,90,0.08)"
          sub="маржа − налог 20%" />
        <Stat label={r.basis === 'unload' ? 'Заявок (по выгрузке)' : 'Создано заявок'}
          value={total} color="#1366F0" bg="rgba(19,102,240,0.08)" />
        <Stat label="Доставлено" value={int(r.delivered)} color="#1E9E5A" bg="rgba(30,158,90,0.08)"
          sub="по дате выгрузки" />
        <Stat label="Оплачено клиентами" value={`${int(r.client_paid_count)} из ${total}`}
          color="#1E9E5A" bg="rgba(30,158,90,0.08)" sub={money(r.client_paid_sum)} />
        <Stat label="Оплачено перевозчикам" value={`${int(r.carrier_paid_count)} из ${total}`}
          color="#1366F0" bg="rgba(19,102,240,0.08)" sub={money(r.carrier_paid_sum)} />
        <Stat label="Просрочка перевозчикам" value={int(r.overdue_carrier_count)} color="#E0473B" bg="rgba(224,71,59,0.08)"
          sub={money(r.overdue_carrier_sum)} />
        <Stat label="Должники (клиенты)" value={int(r.debtors_count)} color="#D97706" bg="rgba(217,119,6,0.08)"
          sub={money(r.debtors_sum)} />
        <Stat label="Звонки" value={int(r.calls_total)} color="#7C3AED" bg="rgba(124,58,237,0.08)"
          sub={`стали клиентами: ${int(r.calls_won)}`} />
      </div>

      {(r.period === 'quarterly' || r.period === 'yearly') && (
        <div style={{ borderTop: '1px solid #F0F1F4', paddingTop: 14 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 13, color: '#0E1726', marginBottom: 12 }}>
            Налог по КУДиР <span style={{ color: '#8A93A0', fontWeight: 400 }}>(по фактическим датам оплат в книге)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
            <Stat label="Строк дохода в книге" value={int(r.kudir_rows_count)} color="#1366F0" bg="rgba(19,102,240,0.08)" sub="за период" />
            <Stat label="Доход по книге (графа 4)" value={money(r.kudir_income)} color="#0E1726" />
            <Stat label={`Налог к уплате (${Math.round((r.tax_rate ?? 0.2) * 100)}%)`} value={money(r.kudir_tax)} color="#E0473B" bg="rgba(224,71,59,0.08)" />
          </div>
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

      {hasTomorrow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #F0F1F4', paddingTop: 14 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 13, color: '#0E1726' }}>
            Завтра{r.tomorrow_date ? ` (${r.tomorrow_date})` : ''}
          </div>
          <LegList title="Загрузки" items={loads} />
          <LegList title="Выгрузки" items={unloads} />
        </div>
      )}
    </div>
  )
}

function ReportRow({ r }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, minWidth: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{rowTitle(r)}</span>
          <span style={{ fontSize: 12.5, color: '#8A93A0' }}>
            выручка {money(r.revenue)} · маржа {money(r.margin)}
          </span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, color: '#1366F0', fontSize: 12.5, fontWeight: 600 }}>
          {open ? 'Свернуть' : 'Открыть'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && <div style={{ borderTop: '1px solid #F0F1F4' }}><ReportBody r={r} /></div>}
    </div>
  )
}

export default function Reports() {
  const { show } = useToast()
  const [tab, setTab] = useState('daily')
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [morning, setMorning] = useState(false)
  const [priv, setPriv] = useState(null)      // { private, chat_ids, env_locked }
  const [myChat, setMyChat] = useState('')
  const [privBusy, setPrivBusy] = useState(false)

  useEffect(() => {
    getBotPrivate().then(setPriv).catch(() => {})
    getBotSubscription().then(r => setMyChat(r.chat_id || '')).catch(() => {})
  }, [])

  const togglePrivate = async () => {
    if (priv?.env_locked) { show('Приватный список задан на сервере (env)', { type: 'info' }); return }
    setPrivBusy(true)
    try {
      if (priv?.private) {
        await setBotPrivate('')
        setPriv({ ...priv, private: false, chat_ids: [] })
        show('Бот снова пишет всем подписчикам', { type: 'success' })
      } else {
        if (!myChat) { show('Сначала подключите свой chat_id (напишите /start боту)', { type: 'error' }); setPrivBusy(false); return }
        await setBotPrivate([myChat])
        setPriv({ ...priv, private: true, chat_ids: [myChat] })
        show('Приватный режим включён — бот пишет только вам', { type: 'success' })
      }
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setPrivBusy(false)
  }

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
      const r = await runReport(tab)
      if (r.sent > 0) {
        show(`Отчёт сформирован, отправлен в Telegram (${r.sent} из ${r.targets})`, { type: 'success' })
      } else if (!r.token_configured) {
        show('Отчёт сформирован, но в Telegram не ушёл: не задан A2_INFO_BOT_TOKEN на сервере', { type: 'error' })
      } else {
        const err = (r.delivery || []).map(d => d.error).filter(Boolean)[0]
        show('Отчёт сформирован, но в Telegram не ушёл' + (err ? `: ${err}` : ' (нет получателей)'), { type: 'error' })
      }
      load()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setRunning(false)
  }

  const sendMorning = async () => {
    setMorning(true)
    try {
      const r = await runMorningBriefing()
      const head = `Утренняя сводка: загрузок ${r.loads}, выгрузок ${r.unloads}, задач ${r.tasks}`
      if (r.sent > 0) show(`${head} — отправлено в Telegram`, { type: 'success' })
      else if (!r.token_configured) show(`${head}. В Telegram не ушло: не задан A2_INFO_BOT_TOKEN`, { type: 'error' })
      else {
        const err = (r.delivery || []).map(d => d.error).filter(Boolean)[0]
        show(`${head}. В Telegram не ушло${err ? ': ' + err : ''}`, { type: 'error' })
      }
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setMorning(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'Onest', fontSize: 20, fontWeight: 800, color: '#0E1726', margin: 0 }}>Отчёты</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {priv && (
            <button
              onClick={togglePrivate}
              disabled={privBusy}
              title={priv.env_locked ? 'Задано на сервере' : (priv.private ? 'Бот пишет только вам' : 'Бот пишет всем подписчикам')}
              style={{ padding: '7px 13px', borderRadius: 99, cursor: privBusy || priv.env_locked ? 'default' : 'pointer', fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', opacity: privBusy ? 0.6 : 1,
                border: priv.private ? 'none' : '1px solid rgba(14,23,38,0.14)',
                background: priv.private ? '#1E9E5A' : '#fff', color: priv.private ? '#fff' : '#5A6573' }}
            >
              {priv.private ? '🔒 Только я' : '🔓 Все подписчики'}
            </button>
          )}
          <button
            onClick={sendMorning}
            disabled={morning}
            style={{ padding: '7px 15px', borderRadius: 99, border: '1px solid rgba(14,23,38,0.14)', cursor: morning ? 'default' : 'pointer', fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600, background: '#fff', color: '#0E1726', opacity: morning ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {morning ? '…' : 'Утренняя сводка'}
          </button>
          <button
            onClick={runNow}
            disabled={running}
            style={{ padding: '7px 15px', borderRadius: 99, border: 'none', cursor: running ? 'default' : 'pointer', fontFamily: 'Manrope', fontSize: 12.5, fontWeight: 600, background: '#0E1726', color: '#fff', opacity: running ? 0.6 : 1, whiteSpace: 'nowrap' }}
          >
            {running ? '…' : 'Сформировать сейчас'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '10px 12px', overflowX: 'auto' }}>
        <SlidingTabs options={TABS} value={tab} onChange={setTab} />
      </div>

      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Загрузка…</div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
          Отчётов пока нет. Формируются автоматически в 21:00 по Минску (день — каждый день, неделя — в пятницу,
          месяц/квартал/год — в последний день периода) либо по кнопке «Сформировать сейчас».
          В 09:00 приходит утренняя сводка: загрузки/выгрузки на сегодня + задачи на сегодня и просроченные.
          Плюс по каждой задаче отдельное сообщение в назначенное ей время.
        </div>
      ) : (
        reports.map(r => <ReportRow key={r.id || r.generated_at} r={r} />)
      )}
    </div>
  )
}
