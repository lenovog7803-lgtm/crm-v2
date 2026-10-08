import { useState, useEffect, useRef } from 'react'
import {
  getMailingState, startMailing, stopMailing, checkMailingInbox,
  getMailingContacts, addMailingContact, updateMailingContact, deleteMailingContact,
  importMailingContacts, mailingContactsFromLeads,
  getMailingSettings, saveMailingSettings, testMailingConnection, previewMailing, sendMailingTestEmail,
  startMailingGoogle, disconnectMailingGoogle,
  getMailingReplies, resolveMailingReply, markMailingRepliesSeen,
} from '../api'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import { CountUp } from '../components/CountUp'
import { CircularProgress } from '../components/CircularProgress'
import { useIsMobile } from '../hooks/useIsMobile'

// «Рассылка» — холодные письма по базе. Вся логика (лимиты, рабочие часы,
// паузы, напоминания, проверка ответов) живёт в backend/mailing.py, здесь
// только управление и просмотр.

const STATUS = {
  new: { label: 'Новый', color: '#5A6573', bg: 'rgba(14,23,38,0.06)' },
  sent: { label: 'Отправлено', color: '#1366F0', bg: 'rgba(19,102,240,0.08)' },
  followup: { label: 'Напоминание', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)' },
  replied: { label: 'Ответил', color: '#0E9F6E', bg: 'rgba(14,159,110,0.1)' },
  interested: { label: 'Интерес', color: '#0E9F6E', bg: 'rgba(14,159,110,0.16)' },
  refused: { label: 'Отказ', color: '#8A93A0', bg: 'rgba(14,23,38,0.05)' },
  deal: { label: 'Сделка', color: '#047857', bg: 'rgba(4,120,87,0.16)' },
  bounce: { label: 'Возврат', color: '#E0473B', bg: 'rgba(224,71,59,0.1)' },
  error: { label: 'Ошибка', color: '#E0473B', bg: 'rgba(224,71,59,0.1)' },
  skip: { label: 'Пропуск', color: '#A6AEB8', bg: 'rgba(14,23,38,0.04)' },
}

const tabsWith = (newReplies) => [
  { key: 'overview', label: 'Обзор' },
  { key: 'replies', label: newReplies ? `Ответы · ${newReplies}` : 'Ответы' },
  { key: 'contacts', label: 'Контакты' },
  { key: 'settings', label: 'Настройки' },
]

// Быстрые фильтры контактов — счётчики приходят из /mailing/state (groups)
const GROUPS = [
  { key: '', label: 'Все' },
  { key: 'answered', label: 'Ответили' },
  { key: 'waiting', label: 'Ждём ответа' },
  { key: 'silent', label: 'Молчат после напоминания' },
  { key: 'failed', label: 'Не дошло' },
]

const gmailLink = (login, email) =>
  `https://mail.google.com/mail/${login ? `?authuser=${encodeURIComponent(login)}` : ''}#search/${encodeURIComponent(`from:${email}`)}`

const fmtTs = (ts) => (ts || '').replace('T', ' ').slice(0, 16)

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1px solid #E8EAEE', background: '#fff', fontSize: 13, fontFamily: 'Manrope', color: '#0E1726',
}
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const sectionTitle = { fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726', marginBottom: 12 }

// ---------------- Обзор ----------------
// В стиле дашборда CRM: hero-карточки с градиентом, KPI-полоса, кольцевой прогресс, CountUp.
const RAMP_STEPS = [{ until: 3, lim: 5 }, { until: 7, lim: 10 }, { until: 12, lim: 15 }, { until: Infinity, lim: 20 }]
const LOG_ICON = { 'письмо': '✉️', 'напоминание': '🔁', 'ответ': '💬', 'возврат': '↩️', 'тест': '🧪', 'автостоп': '⛔️', 'проверка почты': '📥' }

const heroBase = {
  borderRadius: 22, position: 'relative', overflow: 'hidden',
  transition: 'transform 0.2s var(--ease), box-shadow 0.2s var(--ease)',
}
const kicker = (color) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color, marginBottom: 8 })
const bigNum = (color, size) => ({ fontFamily: 'Onest', fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', lineHeight: 1, color })

function Overview({ state, reload, onGoSettings, onGoReplies, onGoContacts, replies }) {
  const { show } = useToast()
  const isMobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (state.running) await stopMailing()
      else await startMailing()
      show(state.running ? 'Рассылка остановлена' : 'Рассылка запущена', { type: 'success' })
      reload()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const checkInbox = async () => {
    setBusy(true)
    try {
      const r = await checkMailingInbox()
      show(`Ответов: ${r.replied}, возвратов: ${r.bounced}`, { type: 'success' })
      reload()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const counts = state.counts || {}
  const groups = state.groups || {}
  const h = state.health || {}
  const sentTotal = Math.max(0, (state.total || 0) - (counts.new || 0) - (counts.skip || 0))
  const answered = groups.answered || 0
  const replyPct = sentTotal ? Math.round((answered / sentTotal) * 100) : 0
  const todayPct = state.limit ? Math.min(100, (state.sent_today / state.limit) * 100) : 0
  const healthTone = h.status === 'stop' ? 'red' : (h.status === 'slow' || h.status === 'paused') ? 'amber' : 'ok'
  const healthCard = {
    ok: { bg: 'linear-gradient(135deg, rgba(214,236,255,0.95), rgba(186,214,255,0.85))', shadow: 'rgba(19,102,240,0.35)', ink: '#0F4FB8', deep: '#0B3A87', label: 'Норма' },
    amber: { bg: 'linear-gradient(135deg, rgba(255,236,214,0.95), rgba(255,213,170,0.85))', shadow: 'rgba(217,119,6,0.4)', ink: '#A86A20', deep: '#7A4A12', label: h.status === 'paused' ? 'Пауза' : 'Темп снижен' },
    red: { bg: 'linear-gradient(135deg, rgba(255,222,222,0.95), rgba(255,190,190,0.85))', shadow: 'rgba(224,71,59,0.4)', ink: '#B4322A', deep: '#7E1D17', label: 'Остановка' },
  }[healthTone]

  const funnel = [
    { label: 'Отправлено', value: sentTotal, color: '#1366F0' },
    { label: 'Ответили', value: answered, color: '#0E9F6E' },
    { label: 'Интерес', value: (counts.interested || 0) + (counts.deal || 0), color: '#D97706' },
    { label: 'Сделка', value: counts.deal || 0, color: '#7C3AED' },
  ]
  const kpis = [
    { label: 'В очереди', value: state.queue_new || 0, hint: state.queue_follow ? `+${state.queue_follow} напоминаний` : 'новых адресов', color: '#1366F0', bg: 'rgba(19,102,240,0.08)', group: '' },
    { label: 'Ждём ответа', value: groups.waiting || 0, hint: 'письмо дошло', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', group: 'waiting' },
    { label: 'Молчат', value: groups.silent || 0, hint: 'после напоминания', color: '#8A93A0', bg: 'rgba(14,23,38,0.05)', group: 'silent' },
    { label: 'Не дошло', value: groups.failed || 0, hint: 'возвраты и ошибки', color: '#E0473B', bg: 'rgba(224,71,59,0.08)', group: 'failed' },
  ]
  const log = state.log || []
  const rampIdx = RAMP_STEPS.findIndex(st => (h.day || 1) <= st.until)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!state.configured && (
        <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#5A6573' }}>Почта ещё не подключена — без неё рассылку не запустить.</div>
          <button className="btn-ghost" onClick={onGoSettings}>Подключить почту →</button>
        </div>
      )}

      {/* Hero */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr 1fr', gap: 16 }}>
        {/* Статус и запуск */}
        <div style={{ ...heroBase, background: 'linear-gradient(135deg, #0E1726 0%, #1A2A4A 100%)', color: '#fff',
          padding: isMobile ? '18px' : '26px 28px', boxShadow: '0 20px 50px -20px rgba(14,23,38,0.6)' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: state.running ? 'rgba(91,232,155,0.12)' : 'rgba(19,102,240,0.15)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: state.running ? '#5BE89B' : 'rgba(255,255,255,0.35)',
                boxShadow: state.running ? '0 0 0 4px rgba(91,232,155,0.2)' : 'none' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)' }}>
                {state.running ? 'РАБОТАЕТ' : 'ОСТАНОВЛЕНА'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={bigNum('#fff', isMobile ? 34 : 42)}><CountUp value={state.sent_today} /></span>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>/ {state.limit} писем сегодня</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.12)', marginTop: 14, overflow: 'hidden' }}>
              <div style={{ width: `${todayPct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #5BE89B, #2FC7A0)', transition: 'width 0.6s var(--ease)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 10, minHeight: 16 }}>
              {state.state}{state.next_at ? ` · дальше в ${state.next_at}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={toggle} disabled={busy || (!state.running && !state.configured)}
                style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'Manrope', fontSize: 13.5, fontWeight: 700,
                  background: state.running ? 'rgba(255,107,122,0.18)' : '#fff', color: state.running ? '#FF8A96' : '#0E1726',
                  opacity: (!state.running && !state.configured) ? 0.5 : 1 }}>
                {state.running ? '■ Остановить' : '▶ Запустить'}
              </button>
              <button onClick={checkInbox} disabled={busy}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
                  color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'Manrope', fontSize: 13, fontWeight: 600 }}>
                Проверить входящие
              </button>
            </div>
          </div>
        </div>

        {/* Ответили */}
        <div onClick={onGoReplies} style={{ ...heroBase, cursor: 'pointer', padding: isMobile ? '16px 18px' : '26px 24px',
          background: 'linear-gradient(135deg, rgba(214,245,228,0.95), rgba(170,230,200,0.85))', border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 16px 40px -16px rgba(14,159,110,0.4)' }}>
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={kicker('#17824F')}>ОТВЕТИЛИ</div>
          <div style={bigNum('#0B5C37', isMobile ? 28 : 34)}><CountUp value={answered} /></div>
          <div style={{ fontSize: 12, color: '#17824F', marginTop: 6 }}>{replyPct}% от отправленных</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#17824F', fontWeight: 700 }}>
            {state.replies_new ? `🔔 ${state.replies_new} новых — разобрать →` : 'Все ответы →'}
          </div>
        </div>

        {/* Здоровье ящика */}
        <div style={{ ...heroBase, padding: isMobile ? '16px 18px' : '26px 24px', background: healthCard.bg,
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: `0 16px 40px -16px ${healthCard.shadow}` }}>
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={kicker(healthCard.ink)}>ЗДОРОВЬЕ ЯЩИКА</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={bigNum(healthCard.deep, isMobile ? 28 : 34)}>{h.bounce_rate ?? 0}%</span>
            <span style={{ fontSize: 12, color: healthCard.ink, fontWeight: 600 }}>возвратов</span>
          </div>
          <div style={{ fontSize: 12, color: healthCard.ink, marginTop: 6 }}>{h.bounced_7d ?? 0} из {h.sent_7d ?? 0} за 7 дней · норма до 4%</div>
          <div style={{ marginTop: 14, display: 'inline-block', padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.55)',
            fontSize: 12, fontWeight: 700, color: healthCard.deep }}>
            {healthCard.label}
          </div>
          {h.reason && <div style={{ fontSize: 11.5, color: healthCard.ink, marginTop: 8, lineHeight: 1.4 }}>{h.reason}</div>}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" onClick={() => onGoContacts(k.group)}
            style={{ padding: isMobile ? '12px 14px' : '18px 20px', cursor: 'pointer' }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'Onest', fontWeight: 800, fontSize: isMobile ? 24 : 32, color: k.color, background: k.bg,
              borderRadius: 12, padding: isMobile ? '5px 10px' : '7px 14px', display: 'inline-block', lineHeight: 1 }}>
              <CountUp value={k.value} />
            </div>
            <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 8 }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Разгон + воронка */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: isMobile ? '16px 14px' : '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <CircularProgress pct={h.auto ? Math.min(100, ((h.day || 1) / 13) * 100) : 100} color="#1366F0" size={56} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1366F0' }}>
                {h.auto ? `д.${h.day || 1}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>Разгон ящика</div>
              <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>
                {h.auto ? `лимит растёт сам · потолок ${h.cap}` : 'выключен — фиксированный лимит из настроек'}
              </div>
            </div>
          </div>
          {h.auto && (
            <div style={{ display: 'flex', gap: 6 }}>
              {RAMP_STEPS.map((st, i) => {
                const capped = st.lim > (h.cap || 0)
                const active = i === rampIdx
                const done = i < rampIdx
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', opacity: capped ? 0.35 : 1 }}>
                    <div style={{ height: 6, borderRadius: 99, background: active ? '#1366F0' : done ? 'rgba(19,102,240,0.45)' : 'rgba(14,23,38,0.08)' }} />
                    <div style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? '#1366F0' : '#8A93A0', marginTop: 6 }}>{st.lim}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: isMobile ? '16px 14px' : '20px 24px' }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>Воронка</div>
          <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2, marginBottom: 14 }}>за всё время</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {funnel.map(f => (
              <div key={f.label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr 44px', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: '#5A6573', fontWeight: 600 }}>{f.label}</span>
                <div style={{ height: 10, borderRadius: 99, background: 'rgba(14,23,38,0.05)', overflow: 'hidden' }}>
                  <div style={{ width: `${sentTotal ? Math.max(f.value ? 3 : 0, (f.value / sentTotal) * 100) : 0}%`, height: '100%', borderRadius: 99,
                    background: f.color, transition: 'width 0.6s var(--ease)' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E1726', textAlign: 'right' }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Новые ответы */}
      {replies.length > 0 && (
        <div className="card" style={{ padding: isMobile ? '16px 14px' : '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>Новые ответы</div>
            <button className="btn-ghost" onClick={onGoReplies}>Разобрать →</button>
          </div>
          {replies.slice(0, 4).map(c => (
            <div key={c.id} onClick={onGoReplies} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(14,23,38,0.05)', cursor: 'pointer' }}>
              <div style={{ width: 34, height: 34, borderRadius: 11, background: 'rgba(14,159,110,0.12)', color: '#0E9F6E', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                {(c.company || c.email || '').trim().charAt(0).toUpperCase() || '?'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726' }}>{c.company || c.email}</div>
                <div style={{ fontSize: 12.5, color: '#5A6573', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.reply_snippet || 'ответ без текста'}
                </div>
              </div>
              <span style={{ fontSize: 11.5, color: '#A6AEB8', flexShrink: 0 }}>{fmtTs(c.replied_at).slice(5)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Журнал */}
      <div className="card" style={{ padding: isMobile ? '16px 14px' : '20px 24px' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 10 }}>Журнал</div>
        {log.length === 0 && <div style={{ fontSize: 13, color: '#A6AEB8' }}>Пока пусто</div>}
        {(logOpen ? log : log.slice(0, 8)).map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid rgba(14,23,38,0.05)', fontSize: 12.5 }}>
            <span style={{ width: 26, height: 26, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              background: l.ok ? 'rgba(14,23,38,0.04)' : 'rgba(224,71,59,0.08)' }}>{LOG_ICON[l.kind] || '•'}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontWeight: 700, color: l.ok ? '#0E1726' : '#E0473B' }}>{l.company || l.email || l.kind}</span>
              <span style={{ color: '#8A93A0' }}> · {l.kind}{l.detail ? ` — ${l.detail}` : ''}</span>
            </div>
            <span style={{ color: '#A6AEB8', flexShrink: 0 }}>{fmtTs(l.ts).slice(5)}</span>
          </div>
        ))}
        {log.length > 8 && (
          <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setLogOpen(o => !o)}>
            {logOpen ? 'Свернуть' : `Показать всё (${log.length})`}
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------- Ответы ----------------
const RESOLVE = [
  { status: 'interested', label: 'Интерес', color: '#0E9F6E' },
  { status: 'deal', label: 'Сделка', color: '#047857' },
  { status: 'refused', label: 'Отказ', color: '#E0473B' },
]

function Replies({ login, onChanged }) {
  const { show } = useToast()
  const [onlyNew, setOnlyNew] = useState(true)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    setLoading(true)
    getMailingReplies(onlyNew)
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }
  useEffect(load, [onlyNew]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolve = async (c, status) => {
    setBusyId(c.id)
    try {
      const r = await resolveMailingReply(c.id, status)
      const label = RESOLVE.find(x => x.status === status)?.label
      show(r.lead_created ? `${label}: лид создан в «Базе обзвона»` : r.lead_id && status !== 'refused' ? `${label}: лид в «Базе обзвона» обновлён` : `Отмечено: ${label}`, { type: 'success' })
      setItems(list => onlyNew ? list.filter(x => x.id !== c.id) : list.map(x => x.id === c.id ? { ...x, status, reply_seen: true } : x))
      onChanged?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusyId(null)
  }

  const seenAll = async () => {
    try {
      await markMailingRepliesSeen(items.map(c => c.id))
      setItems([])
      onChanged?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SlidingTabs options={[{ key: 'new', label: 'Новые' }, { key: 'all', label: 'Все ответы' }]} value={onlyNew ? 'new' : 'all'} onChange={k => setOnlyNew(k === 'new')} />
        {onlyNew && items.length > 0 && <button className="btn-ghost" onClick={seenAll}>Отметить все просмотренными</button>}
      </div>
      <div style={{ fontSize: 12, color: '#8A93A0' }}>
        «Интерес» и «Сделка» добавляют компанию в «Базу обзвона» (или обновляют её лид) — дальше работа идёт там. Ответы проверяются каждые 15 минут, о новых приходит сообщение в Telegram.
      </div>

      {loading && <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}
      {!loading && items.length === 0 && (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
          {onlyNew ? 'Новых ответов нет' : 'Ответов пока нет'}
        </div>
      )}
      {items.map(c => (
        <div key={c.id} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, borderLeft: c.reply_seen === false ? '3px solid #0E9F6E' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{c.company || c.email}</div>
              <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>
                {[c.contact_name, c.email, c.city].filter(Boolean).join(' · ')} · ответ {fmtTs(c.replied_at)}
              </div>
            </div>
            <span style={{ alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 99, background: (STATUS[c.status] || STATUS.replied).bg, color: (STATUS[c.status] || STATUS.replied).color, fontSize: 11.5, fontWeight: 600 }}>
              {(STATUS[c.status] || STATUS.replied).label}
            </span>
          </div>
          {c.reply_subject && <div style={{ fontSize: 12.5, fontWeight: 600, color: '#5A6573' }}>{c.reply_subject}</div>}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#0E1726', lineHeight: 1.55, background: '#F7F8FA', borderRadius: 12, padding: 12, maxHeight: 220, overflowY: 'auto' }}>
            {c.reply_snippet || 'Текст ответа не удалось прочитать — откройте письмо в Gmail.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {RESOLVE.map(b => (
              <button key={b.status} className="btn-ghost" disabled={busyId === c.id}
                onClick={() => resolve(c, b.status)}
                style={c.status === b.status ? { background: b.color, color: '#fff', borderColor: b.color } : { color: b.color }}>
                {b.label}
              </button>
            ))}
            <a className="btn-ghost" href={gmailLink(login, c.email)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Открыть в Gmail ↗</a>
            {c.lead_id && <span style={{ fontSize: 12, color: '#8A93A0' }}>есть в «Базе обзвона»</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- Контакты ----------------
const EMPTY_CONTACT = { company: '', email: '', contact_name: '', city: '', priority: '' }

function Contacts({ onChanged, groups = {}, login, initialGroup = '' }) {
  const { show } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState(initialGroup)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)

  const load = () => {
    setLoading(true)
    getMailingContacts(q, status, group)
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, group])

  const after = (msg) => { show(msg, { type: 'success' }); load(); onChanged?.() }

  const save = async () => {
    setBusy(true)
    try {
      await addMailingContact(form)
      setForm(null)
      after('Контакт добавлен')
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const setContactStatus = async (c, s) => {
    try {
      await updateMailingContact(c.id, { status: s })
      setItems(list => list.map(x => x.id === c.id ? { ...x, status: s } : x))
      onChanged?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const remove = async (c) => {
    if (!window.confirm(`Удалить «${c.company || c.email}» из рассылки?`)) return
    try {
      await deleteMailingContact(c.id)
      after('Удалено')
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const r = await importMailingContacts(file)
      after(`Добавлено: ${r.added}, пропущено (уже есть): ${r.skipped}`)
    } catch (err) {
      show('Ошибка импорта: ' + err.message, { type: 'error' })
    }
    setBusy(false)
  }

  const fromLeads = async () => {
    setBusy(true)
    try {
      const r = await mailingContactsFromLeads()
      after(`Из базы обзвона добавлено: ${r.added}, пропущено: ${r.skipped}`)
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {GROUPS.map(g => {
          const active = group === g.key
          const n = g.key ? groups[g.key] : undefined
          return (
            <button key={g.key} onClick={() => { setGroup(g.key); setStatus('') }}
              style={{ padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'Manrope',
                border: active ? '1px solid #1366F0' : '1px solid rgba(14,23,38,0.12)',
                background: active ? 'rgba(19,102,240,0.1)' : 'rgba(255,255,255,0.7)', color: active ? '#1366F0' : '#5A6573' }}>
              {g.label}{n !== undefined ? ` · ${n}` : ''}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск: компания, email, город" style={{ ...inputStyle, width: 260 }} />
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="">Все статусы</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" onClick={fromLeads} disabled={busy}>Из базы обзвона</button>
        <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>Импорт xlsx</button>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} style={{ display: 'none' }} />
        <button className="btn-primary" onClick={() => setForm({ ...EMPTY_CONTACT })}>+ Контакт</button>
      </div>

      {form && (
        <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end' }}>
          {[['company', 'Компания'], ['email', 'Email'], ['contact_name', 'Имя контакта'], ['city', 'Город']].map(([k, l]) => (
            <div key={k}>
              <div style={labelStyle}>{l}</div>
              <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inputStyle} />
            </div>
          ))}
          <div>
            <div style={labelStyle}>Приоритет</div>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
              <option value="">—</option><option>A</option><option>B</option><option>C</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={() => setForm(null)}>Отмена</button>
            <button className="btn-primary" onClick={save} disabled={busy}>Сохранить</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#8A93A0', fontSize: 11.5 }}>
              {['Компания', 'Email', 'Город', 'Пр.', 'Статус', 'Отправлено', ''].map(h => (
                <th key={h} style={{ padding: '12px 14px', fontWeight: 600, borderBottom: '1px solid rgba(14,23,38,0.07)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(14,23,38,0.05)' }}>
                <td style={{ padding: '10px 14px', color: '#0E1726', fontWeight: 600 }}>
                  {c.company || '—'}
                  {c.contact_name && <div style={{ fontSize: 11.5, color: '#8A93A0', fontWeight: 400 }}>{c.contact_name}</div>}
                </td>
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>
                  {c.email || <span style={{ color: '#C4CAD4' }}>нет email</span>}
                  {c.last_error && <div style={{ fontSize: 11, color: '#E0473B' }}>{c.last_error}</div>}
                  {c.replied_at && <div><a href={gmailLink(login, c.email)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#1366F0' }}>переписка в Gmail ↗</a></div>}
                </td>
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>{c.city || ''}</td>
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>{c.priority || ''}</td>
                <td style={{ padding: '10px 14px' }}>
                  <select
                    value={c.status}
                    onChange={e => setContactStatus(c, e.target.value)}
                    style={{ border: 'none', background: (STATUS[c.status] || STATUS.new).bg, color: (STATUS[c.status] || STATUS.new).color, borderRadius: 99, padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                  </select>
                </td>
                <td style={{ padding: '10px 14px', color: '#8A93A0', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {c.first_sent || ''}{c.followup_sent ? ` · напом. ${c.followup_sent}` : ''}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <button onClick={() => remove(c)} title="Удалить" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}
        {!loading && items.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
            Контактов нет. Загрузите xlsx (колонки «Компания», «Email», «Город», «Приоритет») или перенесите из базы обзвона.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Письмо ----------------
const VARS = ['{приветствие}', '{компания}', '{имя_контакта}', '{моё_имя}', '{моя_компания}', '{телефон}']

function Letter({ settings, onSaved }) {
  const { show } = useToast()
  const [subjects, setSubjects] = useState((settings.subjects || []).join('\n'))
  const [body, setBody] = useState(settings.body || '')
  const [followup, setFollowup] = useState(settings.followup_body || '')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await saveMailingSettings({ subjects, body, followup_body: followup })
      show('Письмо сохранено', { type: 'success' })
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const doPreview = async () => {
    try {
      setPreview(await previewMailing({ subjects, body, followup_body: followup }))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const area = (value, set, rows) => (
    <textarea value={value} onChange={e => set(e.target.value)} rows={rows} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={labelStyle}>Темы письма — по одной на строку, выбирается случайно</div>
          {area(subjects, setSubjects, 3)}
        </div>
        <div>
          <div style={labelStyle}>Текст письма</div>
          {area(body, setBody, 14)}
        </div>
        <div>
          <div style={labelStyle}>Текст напоминания (уходит ответом в ту же цепочку)</div>
          {area(followup, setFollowup, 7)}
        </div>
        <div style={{ fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
          Подставляются: {VARS.map(v => <code key={v} style={{ background: 'rgba(14,23,38,0.05)', padding: '1px 5px', borderRadius: 5, marginRight: 4 }}>{v}</code>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={doPreview}>Предпросмотр</button>
          <button className="btn-primary" onClick={save} disabled={busy}>Сохранить</button>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={sectionTitle}>Предпросмотр</div>
        {!preview && <div style={{ fontSize: 13, color: '#A6AEB8' }}>Нажмите «Предпросмотр», чтобы увидеть письмо для одной из компаний.</div>}
        {preview && [['Письмо', preview.first], ['Напоминание', preview.follow]].map(([title, p]) => (
          <div key={title} style={{ marginBottom: 18 }}>
            <div style={labelStyle}>{title}{preview.company ? ` · ${preview.company}` : ''}</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0E1726', marginBottom: 8 }}>{p.subject}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#5A6573', lineHeight: 1.55, background: '#F7F8FA', borderRadius: 12, padding: 14 }}>{p.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------- Настройки ----------------
const FIELDS = [
  ['Почта', [
    ['login', 'Email отправителя'], ['password', 'Пароль приложения', 'password'], ['from_name', 'Имя в поле «От кого»'],
    ['smtp_host', 'SMTP сервер'], ['smtp_port', 'SMTP порт', 'number'],
    ['imap_host', 'IMAP сервер'], ['imap_port', 'IMAP порт', 'number'],
  ]],
  ['Подпись', [['my_name', 'Ваше имя'], ['my_company', 'Компания'], ['phone', 'Телефон']]],
  ['Режим отправки', [
    ['daily_limit', 'Писем в день', 'number'], ['min_delay', 'Пауза от, сек', 'number'], ['max_delay', 'Пауза до, сек', 'number'],
    ['hour_start', 'Начало, час (Мск)', 'number'], ['hour_end', 'Конец, час (Мск)', 'number'], ['followup_days', 'Напоминание через, дней', 'number'],
  ]],
]

const PRESETS = {
  'Яндекс': { smtp_host: 'smtp.yandex.ru', smtp_port: 465, imap_host: 'imap.yandex.ru', imap_port: 993 },
  'Gmail': { smtp_host: 'smtp.gmail.com', smtp_port: 465, imap_host: 'imap.gmail.com', imap_port: 993 },
  'Mail.ru': { smtp_host: 'smtp.mail.ru', smtp_port: 465, imap_host: 'imap.mail.ru', imap_port: 993 },
}

function Settings({ settings, onSaved }) {
  const { show } = useToast()
  const [s, setS] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [conn, setConn] = useState(null)
  const set = (k, v) => setS(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    setBusy(true)
    try {
      const payload = {}
      FIELDS.forEach(([, fs]) => fs.forEach(([k]) => { payload[k] = s[k] }))
      payload.weekdays_only = !!s.weekdays_only
      payload.auto_limit = !!s.auto_limit
      payload.transport = s.transport || 'smtp'
      payload.followup_enabled = !!s.followup_enabled
      if (settings.password_from_env) delete payload.password
      await saveMailingSettings(payload)
      show('Настройки сохранены', { type: 'success' })
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  // Render free не выпускает SMTP — «Через Google» шлёт по HTTPS через Gmail API.
  // Gmail рассылки подключается отдельно и может быть любым — Google-аккаунт
  // CRM (Документы/Календарь/Задачи) при этом не меняется.
  const connectGoogle = async () => {
    try {
      await saveMailingSettings({ transport: 'gmail_api' })
      set('transport', 'gmail_api')
      const r = await startMailingGoogle()
      window.open(r.auth_url, '_blank')
      show('После подключения в открывшемся окне вернитесь сюда и обновите страницу', { type: 'info' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const disconnectGoogle = async () => {
    if (!window.confirm('Отключить Gmail от рассылки? Google-аккаунт CRM это не затронет.')) return
    try {
      await disconnectMailingGoogle()
      show('Gmail рассылки отключён', { type: 'success' })
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const transport = s.transport || 'smtp'

  const testConn = async () => {
    setBusy(true)
    setConn(null)
    try {
      setConn(await testMailingConnection())
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const testEmail = async () => {
    setBusy(true)
    try {
      await sendMailingTestEmail(testTo)
      show('Пробное письмо отправлено — проверьте ящик', { type: 'success' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={sectionTitle}>Способ отправки</div>
          <SlidingTabs
            options={[{ key: 'gmail_api', label: 'Через Google (Gmail)' }, { key: 'smtp', label: 'SMTP по паролю приложения' }]}
            value={transport}
            onChange={k => set('transport', k)}
          />
          {transport === 'gmail_api' && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: 'rgba(19,102,240,0.06)', border: '1px solid rgba(19,102,240,0.14)' }}>
              <div style={{ fontSize: 12.5, color: '#5A6573', lineHeight: 1.6 }}>
                Письма уходят через Gmail по HTTPS — работает на любом хостинге. Можно выбрать любой Gmail, не обязательно
                тот, что подключён к CRM: Документы, Календарь и Задачи останутся на прежнем аккаунте.
                Пароль приложения ниже нужен только для проверки ответов по IMAP.
              </div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: settings.gmail_connected ? '#0E9F6E' : '#8A93A0' }}>
                {settings.gmail_connected ? `Подключён: ${settings.gmail_connected}` : 'Gmail ещё не подключён'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn-ghost" onClick={connectGoogle}>{settings.gmail_connected ? 'Подключить другой Gmail' : 'Подключить Gmail для рассылки'}</button>
                {settings.gmail_connected && <button className="btn-ghost" onClick={disconnectGoogle}>Отключить</button>}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: '#8A93A0' }}>Заполнить серверы:</span>
          {Object.entries(PRESETS).map(([name, p]) => (
            <button key={name} className="btn-ghost" style={{ padding: '6px 12px' }} onClick={() => setS(prev => ({ ...prev, ...p }))}>{name}</button>
          ))}
        </div>
        {FIELDS.map(([title, fs]) => (
          <div key={title}>
            <div style={sectionTitle}>{title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              {fs.map(([k, l, type]) => (
                <div key={k}>
                  <div style={labelStyle}>{k === 'login' && transport === 'gmail_api' ? 'Ваш Gmail' : k === 'password' && transport === 'gmail_api' ? 'Пароль приложения (для IMAP)' : k === 'daily_limit' && s.auto_limit ? 'Максимум писем в день' : l}</div>
                  <input
                    type={type || 'text'}
                    value={s[k] ?? ''}
                    disabled={k === 'password' && settings.password_from_env}
                    placeholder={k === 'password' && settings.password_from_env ? 'задан в MAIL_PASSWORD на сервере' : ''}
                    onChange={e => set(k, e.target.value)}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: '#0E1726' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!s.auto_limit} onChange={e => set('auto_limit', e.target.checked)} /> Автоматический разгон и защита от бана
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!s.weekdays_only} onChange={e => set('weekdays_only', e.target.checked)} /> Только будни
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!s.followup_enabled} onChange={e => set('followup_enabled', e.target.checked)} /> Отправлять напоминание
          </label>
        </div>
        <div style={{ fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
          Для Яндекса и Gmail нужен не обычный пароль, а «пароль приложения» из настроек безопасности почты.
          {s.auto_limit && <><br />Разгон: лимит растёт сам по дням отправки — 5 → 10 → 15 → 20 (не выше «Максимума»; больше 20 одинаковых писем в день не шлём). Возвратов больше 4% за неделю — темп вдвое ниже, больше 8% — рассылка остановится сама, придёт сообщение в Telegram и задача. Если почта ограничит отправку — пауза до завтра.</>}
        </div>
        <div><button className="btn-primary" onClick={save} disabled={busy}>Сохранить</button></div>
      </div>

      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionTitle}>Проверка</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-ghost" onClick={testConn} disabled={busy}>Проверить подключение</button>
          {conn && (
            <span style={{ fontSize: 12.5, color: '#5A6573' }}>
              SMTP: <b style={{ color: conn.smtp === 'ok' ? '#0E9F6E' : '#E0473B' }}>{conn.smtp}</b>
              {conn.imap && <> · IMAP: <b style={{ color: conn.imap === 'ok' ? '#0E9F6E' : '#E0473B' }}>{conn.imap}</b></>}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={testTo} onChange={e => setTestTo(e.target.value)} placeholder="ваш email для пробного письма" style={{ ...inputStyle, width: 280 }} />
          <button className="btn-ghost" onClick={testEmail} disabled={busy || !testTo}>Отправить пробное</button>
        </div>
      </div>
    </div>
  )
}

function SettingsPage({ settings, onSaved, initialSection = 'mail' }) {
  const [section, setSection] = useState(initialSection)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SlidingTabs options={[{ key: 'mail', label: 'Почта и отправка' }, { key: 'letter', label: 'Текст письма' }]} value={section} onChange={setSection} />
      {section === 'mail' && <Settings settings={settings} onSaved={onSaved} />}
      {section === 'letter' && <Letter key={settings.body} settings={settings} onSaved={onSaved} />}
    </div>
  )
}

// ---------------- Страница ----------------
export default function Mailing() {
  const { show } = useToast()
  const [tab, setTab] = useState('overview')
  const [state, setState] = useState(null)
  const [settings, setSettings] = useState(null)
  const [newReplies, setNewReplies] = useState([])
  const [contactsGroup, setContactsGroup] = useState('')

  const loadState = () => {
    getMailingReplies(true).then(r => setNewReplies(Array.isArray(r) ? r : [])).catch(() => {})
    return getMailingState().then(setState).catch(e => show('Ошибка загрузки рассылки: ' + e.message, { type: 'error' }))
  }
  const loadSettings = () => getMailingSettings().then(setSettings).catch(e => show('Ошибка загрузки настроек: ' + e.message, { type: 'error' }))

  useEffect(() => {
    loadState()
    loadSettings()
    const t = setInterval(loadState, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadAll = () => { loadState(); loadSettings() }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 20, color: '#0E1726' }}>Рассылка</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Письма по базе с дневным лимитом, напоминанием и проверкой ответов</div>
        </div>
        <SlidingTabs options={tabsWith(state?.replies_new)} value={tab} onChange={t => { setContactsGroup(''); setTab(t) }} />
      </div>

      {(!state || !settings) && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}
      {state && settings && (
        <>
          {tab === 'overview' && <Overview state={state} reload={loadState} onGoSettings={() => setTab('settings')} onGoReplies={() => setTab('replies')}
            onGoContacts={g => { setContactsGroup(g); setTab('contacts') }} replies={newReplies} />}
          {tab === 'replies' && <Replies login={settings.login} onChanged={loadState} />}
          {tab === 'contacts' && <Contacts key={contactsGroup} onChanged={loadState} groups={state.groups} login={settings.login} initialGroup={contactsGroup} />}
          {tab === 'settings' && <SettingsPage settings={settings} onSaved={reloadAll} />}
        </>
      )}
    </div>
  )
}
