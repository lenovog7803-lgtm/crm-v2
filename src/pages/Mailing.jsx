import { useState, useEffect, useRef } from 'react'
import {
  getMailingState, startMailing, stopMailing, checkMailingInbox,
  getMailingContacts, addMailingContact, updateMailingContact, deleteMailingContact, importMailingContacts,
  getMailingReplies, resolveMailingReply, previewMailing,
  getMailThread, replyMail, downloadMailAttachment,
  getMailingCampaigns, createMailingCampaign, updateMailingCampaign, deleteMailingCampaign,
  getMailboxes, createMailbox, saveMailbox, deleteMailbox, testMailboxConnection, sendMailboxTestEmail,
  startMailboxGoogle, disconnectMailboxGoogle,
  getSuppliers, updateSupplier, deleteSupplier,
} from '../api'
import { useToast } from '../components/Toast'
import { SlidingTabs } from '../components/SlidingTabs'
import { CircularProgress } from '../components/CircularProgress'
import { useIsMobile } from '../hooks/useIsMobile'
import { ThinkingOrb } from 'thinking-orbs'
import { Loader } from '../components/Loader'
import { IconSwap, PopNumber, SwapText } from '../components/Transitions'
import Select from '../components/Select'
import Switch from '../components/Switch'
import { EmptyState } from '../components/EmptyState'

// «Рассылка» — холодные письма по базе. Вся логика (лимиты, рабочие часы,
// паузы, напоминания, проверка ответов) живёт в backend/mailing.py, здесь
// только управление и просмотр. Направления (кампании) — свой текст и свои
// контакты; почтовые ящики — подключение, подпись, лимиты и разгон.

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

const tabsWith = (newReplies, withSuppliers) => [
  { key: 'overview', label: 'Обзор' },
  { key: 'replies', label: newReplies ? `Почта · ${newReplies}` : 'Почта' },
  { key: 'contacts', label: 'Контакты' },
  ...(withSuppliers ? [{ key: 'suppliers', label: 'Поставщики' }] : []),
  { key: 'settings', label: 'Настройки' },
]

const KIND_LABEL = { sale: 'продажа', clients: 'поиск клиентов', purchase: 'закупка' }

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
  border: '1px solid #E8EAEE', background: '#fff', fontSize: 13, fontFamily: 'var(--font-sys)', color: '#0E1726',
}
const labelStyle = { fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }
const sectionTitle = { fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 15, color: '#0E1726', marginBottom: 12 }


// Когда рассылка продолжит после дневного лимита: следующий будний день (по Москве).
const nextWorkdayLabel = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
  const d = new Date(now); d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  const days = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / 864e5)
  if (days === 1) return 'завтра утром'
  return ['в воскресенье', 'в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу'][d.getDay()] + ' утром'
}

// ---------------- Обзор ----------------
// В стиле дашборда CRM: hero-карточки с градиентом, KPI-полоса, кольцевой прогресс, CountUp.
const RAMP_STEPS = [{ until: 3, lim: 5 }, { until: 7, lim: 10 }, { until: 12, lim: 15 }, { until: Infinity, lim: 20 }]
const LOG_ICON = { 'письмо': '✉️', 'напоминание': '🔁', 'ответ': '💬', 'возврат': '↩️', 'тест': '🧪', 'автостоп': '⛔️', 'проверка почты': '📥' }

const heroBase = {
  borderRadius: 22, position: 'relative', overflow: 'clip',
  transition: 'transform 0.2s var(--ease), box-shadow 0.2s var(--ease)',
}
const kicker = (color) => ({ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color, marginBottom: 8 })
const bigNum = (color, size) => ({ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: size, letterSpacing: '-0.03em', lineHeight: 1, color })

function Overview({ state, campaignId, reload, onGoSettings, onGoReplies, onGoContacts, replies }) {
  const { show } = useToast()
  const isMobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [logOpen, setLogOpen] = useState(false)

  const toggle = async () => {
    setBusy(true)
    try {
      if (state.running) await stopMailing(campaignId)
      else await startMailing(campaignId)
      const what = state.campaign ? `«${state.campaign.name}»` : 'Все направления'
      show(state.running ? `${what}: остановлено` : `${what}: запущено`, { type: 'success' })
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
  const boxes = state.mailboxes || []
  const multi = boxes.length > 1
  // здоровье по всем почтам: возвраты суммой, статус — худший из почт
  const sent7 = multi ? boxes.reduce((n, m) => n + (m.health?.sent_7d || 0), 0) : (h.sent_7d ?? 0)
  const bounced7 = multi ? boxes.reduce((n, m) => n + (m.health?.bounced_7d || 0), 0) : (h.bounced_7d ?? 0)
  const bounceRate = multi ? (sent7 ? Math.round((bounced7 / sent7) * 1000) / 10 : 0) : (h.bounce_rate ?? 0)
  const shortLogin = (m) => (m.login || m.name || '').split('@')[0]
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
          <div style={{ fontSize: 13, color: '#5A6573' }}>Почта {state.mailboxes?.length === 1 ? `«${state.mailboxes[0].name}» ` : ''}ещё не подключена — без неё рассылку не запустить.</div>
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
              {/* вместо точки статуса — маленькая сфера: работает — зелёная и крутится, стоит — замерла и потускнела */}
              <ThinkingOrb state="searching" size={20} dotSize={1.7} color={state.running ? '#7CF5B0' : 'rgba(255,255,255,0.45)'}
                paused={!state.running} aria-label={state.running ? 'Рассылка работает' : 'Рассылка остановлена'} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.5)' }}>
                {state.running ? 'РАБОТАЕТ' : 'ОСТАНОВЛЕНО'}{state.campaign ? ` · ${state.campaign.name.toUpperCase()}` : ' · ВСЕ НАПРАВЛЕНИЯ'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={bigNum('#fff', isMobile ? 34 : 42)}><PopNumber value={state.sent_today} /></span>
              <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>/ {state.limit} писем сегодня</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.12)', marginTop: 14, overflow: 'hidden' }}>
              <div style={{ width: `${todayPct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #5BE89B, #2FC7A0)', transition: 'width 0.6s var(--ease)' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 10, minHeight: 16 }}>
              {state.running && state.limit > 0 && state.sent_today >= state.limit
                ? `Лимит на сегодня выполнен — продолжу ${nextWorkdayLabel()}`
                : <>{state.state}{state.next_at ? ` · дальше в ${state.next_at}` : ''}</>}
            </div>
            {multi && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                {boxes.map(m => (
                  <span key={m.id}>{shortLogin(m)}: <b style={{ color: '#fff' }}><PopNumber value={m.sent_today ?? 0} /></b>/{m.health?.limit ?? 0}</span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={toggle} disabled={busy || (!state.running && !state.configured)}
                style={{ padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sys)', fontSize: 13.5, fontWeight: 700,
                  background: state.running ? 'rgba(255,107,122,0.18)' : '#fff', color: state.running ? '#FF8A96' : '#0E1726',
                  opacity: (!state.running && !state.configured) ? 0.5 : 1 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconSwap on={state.running} a="▶" b="■" />
                  <SwapText>{state.running ? 'Остановить' : 'Запустить'}</SwapText>
                </span>
              </button>
              <button onClick={checkInbox} disabled={busy}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent',
                  color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'var(--font-sys)', fontSize: 13, fontWeight: 600 }}>
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
          <div style={bigNum('#0B5C37', isMobile ? 28 : 34)}><PopNumber value={answered} /></div>
          <div style={{ fontSize: 12, color: '#17824F', marginTop: 6 }}>{replyPct}% от отправленных</div>
          <div style={{ marginTop: 14, fontSize: 12.5, color: '#17824F', fontWeight: 700 }}>
            {state.replies_new ? `🔔 ${state.replies_new} новых — разобрать →` : 'Все ответы →'}
          </div>
        </div>

        {/* Здоровье ящика */}
        <div style={{ ...heroBase, padding: isMobile ? '16px 18px' : '26px 24px', background: healthCard.bg,
          border: '1px solid rgba(255,255,255,0.6)', boxShadow: `0 16px 40px -16px ${healthCard.shadow}` }}>
          <div style={{ position: 'absolute', bottom: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          <div style={kicker(healthCard.ink)}>{multi ? `ЗДОРОВЬЕ ПОЧТ · ${boxes.length}` : `ЗДОРОВЬЕ ЯЩИКА${boxes[0]?.login ? ` · ${boxes[0].login}` : ''}`}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={bigNum(healthCard.deep, isMobile ? 28 : 34)}>{bounceRate}%</span>
            <span style={{ fontSize: 12, color: healthCard.ink, fontWeight: 600 }}>возвратов</span>
          </div>
          <div style={{ fontSize: 12, color: healthCard.ink, marginTop: 6 }}>{bounced7} из {sent7} за 7 дней · норма до 4%</div>
          {multi && (
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {boxes.map(m => {
                const mh = m.health || {}
                const st = mh.status || 'ok'
                // меньше 10 писем — процент ещё ничего не значит (1 из 4 = 25%), защита судит с 10-го
                const early = st === 'ok' && (mh.sent_7d || 0) < 10 && (mh.bounced_7d || 0) > 0
                const dot = st === 'stop' ? '#E0473B' : st === 'ok' && !early ? '#0E9F6E' : '#D97706'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: healthCard.deep }}
                    title={early ? 'Мало писем для выводов — защита оценивает почту с 10 отправленных' : undefined}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.login || m.name}</span>
                    <span style={{ opacity: 0.7 }}>{mh.bounced_7d ?? 0} из {mh.sent_7d ?? 0}</span>
                    <b style={{ minWidth: 34, textAlign: 'right' }}>{mh.bounce_rate ?? 0}%</b>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ marginTop: 14, display: 'inline-block', padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.55)',
            fontSize: 12, fontWeight: 700, color: healthCard.deep }}>
            {healthTone === 'ok' && bounceRate > 4 ? 'Норма · мало писем для выводов' : healthCard.label}
          </div>
          {h.reason && <div style={{ fontSize: 11.5, color: healthCard.ink, marginTop: 8, lineHeight: 1.4 }}>{h.reason}</div>}
          {!h.reason && healthTone === 'ok' && bounceRate > 4 && (
            <div style={{ fontSize: 11.5, color: healthCard.ink, marginTop: 8, lineHeight: 1.4 }}>
              Защита оценивает каждую почту с 10 отправленных: больше 4% — темп вдвое ниже, больше 8% (от 20 писем) — остановка.
            </div>
          )}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} className="card" onClick={() => onGoContacts(k.group)}
            style={{ padding: isMobile ? '12px 14px' : '18px 20px', cursor: 'pointer' }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: '#A6AEB8', fontWeight: 600, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 800, fontSize: isMobile ? 24 : 32, color: k.color, background: k.bg,
              borderRadius: 12, padding: isMobile ? '5px 10px' : '7px 14px', display: 'inline-block', lineHeight: 1 }}>
              <PopNumber value={k.value} />
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
              <CircularProgress pct={multi ? Math.min(100, (state.limit / Math.max(1, boxes.reduce((n, m) => n + (m.health?.cap || 0), 0))) * 100)
                : h.auto ? Math.min(100, ((h.day || 1) / 13) * 100) : 100} color="#1366F0" size={56} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#1366F0' }}>
                {multi ? state.limit : h.auto ? `д.${h.day || 1}` : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>{multi ? `Разгон почт · ${boxes.length}` : 'Разгон ящика'}</div>
              <div style={{ fontSize: 12, color: '#A6AEB8', marginTop: 2 }}>
                {multi ? `сегодня всего ${state.limit} писем · потолок ${boxes.reduce((n, m) => n + (m.health?.cap || 0), 0)}`
                  : h.auto ? `лимит растёт сам · потолок ${h.cap}` : 'выключен — фиксированный лимит из настроек'}
              </div>
            </div>
          </div>
          {multi && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {boxes.map(m => {
                const mh = m.health || {}
                const idx = RAMP_STEPS.findIndex(st => (mh.day || 1) <= st.until)
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.login || m.name}</span>
                      <span style={{ color: '#8A93A0', flexShrink: 0 }}>
                        {mh.auto ? `день ${mh.day || 1} · ${mh.limit ?? 0} в день` : `${mh.limit ?? 0} в день`}
                      </span>
                    </div>
                    {mh.auto && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {RAMP_STEPS.map((st, i) => (
                          <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, opacity: st.lim > (mh.cap || 0) ? 0.35 : 1,
                            background: i === idx ? '#1366F0' : i < idx ? 'rgba(19,102,240,0.45)' : 'rgba(14,23,38,0.08)' }} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!multi && h.auto && (
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
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>Воронка</div>
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
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726' }}>Новые ответы</div>
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
        <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 14, color: '#0E1726', marginBottom: 10 }}>Журнал</div>
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

const TAG_COLORS = {
  purchase: ['rgba(217,119,6,0.1)', '#B45309'],
  clients: ['rgba(14,159,110,0.1)', '#0E7A55'],
  sale: ['rgba(19,102,240,0.08)', '#1366F0'],
}

function CampaignTag({ name, kind }) {
  const [bg, color] = TAG_COLORS[kind] || TAG_COLORS.sale
  return (
    <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      background: bg, color }}>
      {name}
    </span>
  )
}

// ---------------- Ответы ----------------
const RESOLVE = [
  { status: 'interested', label: 'Интерес', color: '#0E9F6E' },
  { status: 'deal', label: 'Сделка', color: '#047857' },
  { status: 'refused', label: 'Отказ', color: '#E0473B' },
]

function Replies({ campaignId, loginFor, onChanged }) {
  const { show } = useToast()
  const isMobile = useIsMobile()
  const [onlyNew, setOnlyNew] = useState(false)
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)

  const load = (silent = false) => {
    if (!silent) setLoading(true)
    getMailingReplies(onlyNew, campaignId)
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(e => { if (!silent) show('Ошибка загрузки: ' + e.message, { type: 'error' }) })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
    // новые письма появляются сами, без обновления страницы
    const t = setInterval(() => { if (!document.hidden) load(true) }, 20000)
    return () => clearInterval(t)
  }, [onlyNew, campaignId]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (c) => {
    setOpenId(c.id)
    if (c.reply_seen === false) {
      setItems(list => list.map(x => x.id === c.id ? { ...x, reply_seen: true } : x))
      setTimeout(() => onChanged?.(), 800)  // счётчик новых на вкладке
    }
  }
  const patch = (id, upd) => setItems(list => list.map(x => x.id === id ? { ...x, ...upd } : x))
  const query = q.trim().toLowerCase()
  const shown = query ? items.filter(c => [c.company, c.email, c.contact_name, c.reply_snippet].join(' ').toLowerCase().includes(query)) : items
  const current = items.find(c => c.id === openId)

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SlidingTabs options={[{ key: 'all', label: 'Все' }, { key: 'new', label: 'Новые' }]} value={onlyNew ? 'new' : 'all'} onChange={k => setOnlyNew(k === 'new')} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по переписке" style={{ ...inputStyle, flex: 1, minWidth: 140 }} />
      </div>
      {loading && <Loader padding={30} />}
      {!loading && shown.length === 0 && (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
          {onlyNew ? 'Новых писем нет' : 'Здесь появятся компании, которые ответили на рассылку'}
        </div>
      )}
      {shown.map(c => {
        const st = STATUS[c.status] || STATUS.replied
        const active = c.id === openId
        return (
          <button key={c.id} onClick={() => open(c)} className="ios-row"
            style={{ textAlign: 'left', border: 'none', cursor: 'pointer', padding: '12px 14px', borderRadius: 14, fontFamily: 'inherit',
              background: active ? 'rgba(37,99,235,0.08)' : '#fff', boxShadow: active ? 'inset 0 0 0 1px rgba(37,99,235,0.35)' : '0 1px 2px rgba(14,23,38,0.06)',
              display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {c.reply_seen === false && <span style={{ width: 8, height: 8, borderRadius: 99, background: '#2563EB', flexShrink: 0 }} />}
              <span style={{ fontFamily: 'var(--font-sys)', fontWeight: c.reply_seen === false ? 800 : 600, fontSize: 14, color: '#0E1726', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || c.email}</span>
              <span style={{ fontSize: 11, color: '#8A93A0', flexShrink: 0 }}>{fmtTs(c.replied_at).slice(5)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: '#5A6573', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(c.reply_snippet || c.reply_subject || '').replace(/\s+/g, ' ')}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ padding: '1px 8px', borderRadius: 99, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600 }}>{st.label}</span>
              {c.awaiting_reply && <span style={{ fontSize: 11, color: '#8A93A0' }}>ждём ответа</span>}
              {!campaignId && c.campaign_name && <span style={{ fontSize: 11, color: '#8A93A0' }}>{c.campaign_name}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )

  const thread = current
    ? <MailThread key={current.id} contact={current} gmailHref={gmailLink(loginFor(current.campaign_id), current.email)}
        onBack={isMobile ? () => setOpenId(null) : null}
        onPatch={upd => { patch(current.id, upd); onChanged?.() }} />
    : <div className="card" style={{ padding: 40, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Выберите переписку слева</div>

  if (isMobile) return current ? thread : list
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto', paddingRight: 4 }}>{list}</div>
      {thread}
    </div>
  )
}

const fmtSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`

function MailThread({ contact: c, gmailHref, onBack, onPatch }) {
  const { show } = useToast()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sentOk, setSentOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)

  const load = (silent = false) => {
    if (!silent) setErr('')
    getMailThread(c.id).then(setData).catch(e => { if (!silent) setErr(e.message) })
  }
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load(true) }, 30000)
    return () => clearInterval(t)
  }, [c.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // прокручиваем вниз только когда появилось новое письмо, а не при каждом тихом обновлении
  const count = data?.messages?.length || 0
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [count])

  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      await replyMail(c.id, text)
      show('Ответ отправлен', { type: 'success' })
      setText('')
      setSentOk(true)
      setTimeout(() => setSentOk(false), 1800)
      onPatch({ awaiting_reply: true })
      setTimeout(load, 1500)  // Gmail показывает отправленное не мгновенно
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setSending(false)
  }

  const resolve = async (status) => {
    setBusy(true)
    try {
      const r = await resolveMailingReply(c.id, status)
      const label = RESOLVE.find(x => x.status === status)?.label
      show(r.supplier_created ? `${label}: добавлен в «Поставщики»` : `Отмечено: ${label}`, { type: 'success' })
      onPatch({ status, reply_seen: true })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const download = (m, a) => downloadMailAttachment(c.id, m.id, a.index, a.name).catch(e => show('Ошибка: ' + e.message, { type: 'error' }))

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(14,23,38,0.06)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && <button className="btn-ghost" onClick={onBack} aria-label="Назад" style={{ padding: '6px 10px' }}>‹</button>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 16, color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company || c.email}</div>
            <div style={{ fontSize: 12, color: '#8A93A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[c.contact_name, c.email, data?.mailbox && `с почты ${data.mailbox}`].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RESOLVE.map(b => (
            <button key={b.status} className="btn-ghost" disabled={busy} onClick={() => resolve(b.status)}
              style={c.status === b.status ? { background: b.color, color: '#fff', borderColor: b.color } : { color: b.color }}>
              {b.label}
            </button>
          ))}
          <a className="btn-ghost" href={gmailHref} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Gmail ↗</a>
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: '#F7F8FA',
        maxHeight: onBack ? 'none' : 'calc(100dvh - 400px)', minHeight: 200, overflowY: 'auto' }}>
        {!data && !err && <Loader padding={20} state="listening" label="Загрузка переписки…" />}
        {err && <div style={{ color: '#E0473B', fontSize: 13 }}>{err}</div>}
        {data?.hint && (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(217,119,6,0.08)', color: '#B45309', fontSize: 12.5, fontWeight: 600 }}>{data.hint}</div>
        )}
        {data?.messages?.map(m => (
          <div key={m.id} style={{ alignSelf: m.from_me ? 'flex-end' : 'flex-start', maxWidth: '88%',
            background: m.from_me ? '#2563EB' : '#fff', color: m.from_me ? '#fff' : '#0E1726',
            borderRadius: 16, padding: '10px 14px', boxShadow: m.from_me ? 'none' : '0 1px 2px rgba(14,23,38,0.08)' }}>
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 4 }}>
              {m.from_me ? 'Вы' : (c.contact_name || c.company || c.email)} · {fmtTs(m.date)}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{m.text || '(без текста)'}</div>
            {m.attachments?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {m.attachments.map(a => (
                  <button key={a.index} onClick={() => download(m, a)}
                    style={{ border: 'none', cursor: 'pointer', borderRadius: 10, padding: '6px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      background: m.from_me ? 'rgba(255,255,255,0.2)' : 'rgba(37,99,235,0.08)', color: m.from_me ? '#fff' : '#1D4ED8' }}>
                    📎 {a.name} · {fmtSize(a.size)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div style={{ padding: 12, borderTop: '1px solid rgba(14,23,38,0.06)', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Ваш ответ…"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
          style={{ ...inputStyle, flex: 1, resize: 'vertical', minHeight: 64, fontSize: 16 }} />
        <button className="btn-primary" disabled={sending || !text.trim()} onClick={send} style={{ flexShrink: 0 }}>
          <SwapText>{sending ? 'Отправляю…' : sentOk ? 'Отправлено ✓' : 'Отправить'}</SwapText>
        </button>
      </div>
    </div>
  )
}

// ---------------- Контакты ----------------
const EMPTY_CONTACT = { company: '', email: '', contact_name: '', city: '', priority: '' }

function Contacts({ campaignId, campaignName, onChanged, groups = {}, loginFor, initialGroup = '' }) {
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
    getMailingContacts(q, status, group, campaignId)
      .then(r => setItems(Array.isArray(r) ? r : []))
      .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, group, campaignId])

  const after = (msg) => { show(msg, { type: 'success' }); load(); onChanged?.() }

  const save = async () => {
    setBusy(true)
    try {
      await addMailingContact({ ...form, campaign_id: campaignId })
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
      const r = await importMailingContacts(file, campaignId)
      after(`В «${campaignName}» добавлено: ${r.added}, пропущено (уже есть): ${r.skipped}`)
    } catch (err) {
      show('Ошибка импорта: ' + err.message, { type: 'error' })
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
              style={{ padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sys)',
                border: active ? '1px solid #1366F0' : '1px solid rgba(14,23,38,0.12)',
                background: active ? 'rgba(19,102,240,0.1)' : 'rgba(255,255,255,0.7)', color: active ? '#1366F0' : '#5A6573' }}>
              {g.label}{n !== undefined ? ` · ${n}` : ''}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск: компания, email, город" style={{ ...inputStyle, width: 260 }} />
        <Select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="">Все статусы</option>
          {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </Select>
        <div style={{ flex: 1 }} />
        {campaignId ? (
          <>
            <button className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>Импорт xlsx</button>
            <input ref={fileRef} type="file" accept=".xlsx" onChange={onFile} style={{ display: 'none' }} />
            <button className="btn-primary" onClick={() => setForm({ ...EMPTY_CONTACT })}>+ Контакт</button>
          </>
        ) : (
          <span style={{ fontSize: 12.5, color: '#8A93A0' }}>Чтобы добавить контакты, выберите направление вверху</span>
        )}
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
            <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
              <option value="">—</option><option>A</option><option>B</option><option>C</option>
            </Select>
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
              {['Компания', ...(campaignId ? [] : ['Направление']), 'Email', 'Город', 'Пр.', 'Статус', 'Отправлено', ''].map(h => (
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
                {!campaignId && <td style={{ padding: '10px 14px', color: '#5A6573', fontSize: 12, whiteSpace: 'nowrap' }}>{c.campaign_name}</td>}
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>
                  {c.email || <span style={{ color: '#C4CAD4' }}>нет email</span>}
                  {c.last_error && <div style={{ fontSize: 11, color: '#E0473B' }}>{c.last_error}</div>}
                  {c.replied_at && <div><a href={gmailLink(loginFor(c.campaign_id), c.email)} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: '#1366F0' }}>переписка в Gmail ↗</a></div>}
                </td>
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>{c.city || ''}</td>
                <td style={{ padding: '10px 14px', color: '#5A6573' }}>{c.priority || ''}</td>
                <td style={{ padding: '10px 14px' }}>
                  <Select
                    value={c.status}
                    onChange={e => setContactStatus(c, e.target.value)}
                    style={{ border: 'none', background: (STATUS[c.status] || STATUS.new).bg, color: (STATUS[c.status] || STATUS.new).color, borderRadius: 99, padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                  </Select>
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
        {loading && <Loader padding={30} />}
        {!loading && items.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>
            Контактов нет. Загрузите xlsx: колонки «Компания», «Email», «Имя контакта», «Город», «Приоритет».
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Настройки направления (письмо) ----------------
const VARS = ['{приветствие}', '{компания}', '{имя_контакта}', '{моё_имя}', '{моя_компания}', '{телефон}']

function CampaignSettings({ campaign, mailboxes, onSaved, onDeleted }) {
  const { show } = useToast()
  const [c, setC] = useState({ ...campaign, subjects: (campaign.subjects || []).join('\n') })
  const [savedOk, setSavedOk] = useState(false)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setC(prev => ({ ...prev, [k]: v }))
  const boxes = c.mailbox_ids?.length ? c.mailbox_ids : [c.mailbox_id || 'main']
  // хотя бы одна почта должна остаться
  const toggleBox = (id) => set('mailbox_ids', boxes.includes(id) ? (boxes.length > 1 ? boxes.filter(x => x !== id) : boxes) : [...boxes, id])

  const payload = () => ({
    name: c.name, kind: c.kind, mailbox_ids: boxes, subjects: c.subjects, body: c.body,
    followup_body: c.followup_body, followup_enabled: !!c.followup_enabled, followup_days: c.followup_days,
  })

  const save = async () => {
    setBusy(true)
    try {
      await updateMailingCampaign(campaign.id, payload())
      show('Направление сохранено', { type: 'success' })
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 1800)
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const [pvBox, setPvBox] = useState(null)
  const doPreview = async (box = pvBox) => {
    const mailbox_id = boxes.includes(box) ? box : boxes[0]
    setPvBox(mailbox_id)
    try {
      setPreview(await previewMailing({ campaign_id: campaign.id, mailbox_id, subjects: c.subjects, body: c.body, followup_body: c.followup_body }))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const remove = async () => {
    if (!window.confirm(`Удалить направление «${campaign.name}»? Контакты и ответы в нём перестанут показываться.`)) return
    try {
      await deleteMailingCampaign(campaign.id)
      show('Направление удалено', { type: 'success' })
      onDeleted?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const area = (k, rows) => (
    <textarea value={c[k] || ''} onChange={e => set(k, e.target.value)} rows={rows} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
  )
  const hasBlanks = /\[[^\]\n]{2,}\]/.test(`${c.subjects} ${c.body} ${c.followup_enabled ? c.followup_body : ''}`)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, alignItems: 'start' }}>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <div style={labelStyle}>Название</div>
            <input value={c.name || ''} onChange={e => set('name', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Тип</div>
            <Select value={c.kind} onChange={e => set('kind', e.target.value)} style={inputStyle}>
              <option value="sale">Продажа товара</option>
              <option value="clients">Поиск клиентов</option>
              <option value="purchase">Закупка — ищем поставщиков</option>
            </Select>
          </div>
          <div>
            <div style={labelStyle}>С каких почт{boxes.length > 1 ? ` · ${boxes.length}` : ''}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {mailboxes.map(m => {
                const on = boxes.includes(m.id)
                return (
                  <button key={m.id} type="button" onClick={() => toggleBox(m.id)} aria-pressed={on}
                    style={{ padding: '7px 11px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${on ? '#2563EB' : 'rgba(14,23,38,0.12)'}`,
                      background: on ? 'rgba(37,99,235,0.08)' : '#fff', color: on ? '#1D4ED8' : '#5A6573' }}>
                    {on ? '✓ ' : ''}{m.login || m.name || 'Почта'}
                  </button>
                )
              })}
            </div>
            {boxes.length > 1 && (
              <div style={{ fontSize: 12, color: '#5A6573', marginTop: 6 }}>
                Каждая почта шлёт свой дневной лимит, напоминание уходит с той же почты, что и первое письмо.
              </div>
            )}
          </div>
        </div>
        {hasBlanks && (
          <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(217,119,6,0.08)', color: '#B45309', fontSize: 12.5, fontWeight: 600 }}>
            В тексте остались [заготовки в квадратных скобках] — замените их своим текстом, иначе направление не запустится.
          </div>
        )}
        <div>
          <div style={labelStyle}>Темы письма — по одной на строку, выбирается случайно</div>
          {area('subjects', 3)}
        </div>
        <div>
          <div style={labelStyle}>Текст письма</div>
          {area('body', 14)}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: '#0E1726' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <Switch size="sm" checked={!!c.followup_enabled} onChange={e => set('followup_enabled', e.target.checked)} /> Отправлять напоминание через
          </label>
          <input type="number" min={1} value={c.followup_days ?? 4} onChange={e => set('followup_days', e.target.value)} style={{ ...inputStyle, width: 70 }} />
          <span>дней</span>
        </div>
        {c.followup_enabled && (
          <div>
            <div style={labelStyle}>Текст напоминания (уходит ответом в ту же цепочку)</div>
            {area('followup_body', 7)}
          </div>
        )}
        <div style={{ fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
          Подставляются в тему и текст: {VARS.map(v => <code key={v} style={{ background: 'rgba(14,23,38,0.05)', padding: '1px 5px', borderRadius: 5, marginRight: 4 }}>{v}</code>)}
          <br />Имя, компания и телефон берутся из подписи выбранной почты.
          <br />Варианты слов: <code style={{ background: 'rgba(14,23,38,0.05)', padding: '1px 5px', borderRadius: 5 }}>{'{Добрый день|Здравствуйте}'}</code> — в каждое письмо попадёт один вариант наугад, письма не одинаковые слово в слово, так меньше шансов попасть в спам. Нажимайте «Предпросмотр» несколько раз, чтобы увидеть разные варианты.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => doPreview()}>Предпросмотр</button>
          <button className="btn-primary" onClick={save} disabled={busy}><SwapText>{busy ? 'Сохраняю…' : savedOk ? 'Сохранено ✓' : 'Сохранить'}</SwapText></button>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={remove} style={{ color: '#E0473B' }}>Удалить направление</button>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={sectionTitle}>Предпросмотр</div>
        {preview && boxes.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: '#8A93A0' }}>Письмо с почты:</span>
            {mailboxes.filter(m => boxes.includes(m.id)).map(m => (
              <button key={m.id} type="button" onClick={() => doPreview(m.id)}
                style={{ padding: '5px 10px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${pvBox === m.id ? '#2563EB' : 'rgba(14,23,38,0.12)'}`,
                  background: pvBox === m.id ? 'rgba(37,99,235,0.08)' : '#fff', color: pvBox === m.id ? '#1D4ED8' : '#5A6573' }}>
                {m.login || m.name}
              </button>
            ))}
          </div>
        )}
        {!preview && <div style={{ fontSize: 13, color: '#A6AEB8' }}>Нажмите «Предпросмотр», чтобы увидеть письмо для одной из компаний.</div>}
        {preview && [['Письмо', preview.first], ...(c.followup_enabled ? [['Напоминание', preview.follow]] : [])].map(([title, p]) => (
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

// ---------------- Настройки почты (ящик) ----------------
const FIELDS = [
  ['Почта', [
    ['name', 'Название ящика'], ['login', 'Email отправителя'], ['password', 'Пароль приложения', 'password'], ['from_name', 'Имя в поле «От кого»'],
    ['smtp_host', 'SMTP сервер'], ['smtp_port', 'SMTP порт', 'number'],
    ['imap_host', 'IMAP сервер'], ['imap_port', 'IMAP порт', 'number'],
  ]],
  ['Подпись', [['my_name', 'Ваше имя'], ['my_company', 'Компания'], ['phone', 'Телефон']]],
  ['Режим отправки', [
    ['daily_limit', 'Писем в день', 'number'], ['min_delay', 'Пауза от, сек', 'number'], ['max_delay', 'Пауза до, сек', 'number'],
    ['hour_start', 'Начало, час (Мск)', 'number'], ['hour_end', 'Конец, час (Мск)', 'number'],
  ]],
]

const PRESETS = {
  'Яндекс': { smtp_host: 'smtp.yandex.ru', smtp_port: 465, imap_host: 'imap.yandex.ru', imap_port: 993 },
  'Gmail': { smtp_host: 'smtp.gmail.com', smtp_port: 465, imap_host: 'imap.gmail.com', imap_port: 993 },
  'Mail.ru': { smtp_host: 'smtp.mail.ru', smtp_port: 465, imap_host: 'imap.mail.ru', imap_port: 993 },
}

function MailboxSettings({ mailbox, onSaved, onDeleted }) {
  const { show } = useToast()
  const [s, setS] = useState(mailbox)
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
      if (mailbox.password_from_env) delete payload.password
      await saveMailbox(mailbox.id, payload)
      show('Почта сохранена', { type: 'success' })
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  // Render free не выпускает SMTP — «Через Google» шлёт по HTTPS через Gmail API.
  // У каждого ящика рассылки свой Gmail — Google-аккаунт CRM (Документы/Календарь) не меняется.
  const connectGoogle = async () => {
    try {
      const r = await startMailboxGoogle(mailbox.id)
      set('transport', 'gmail_api')
      window.open(r.auth_url, '_blank')
      show('После подключения в открывшемся окне вернитесь сюда и обновите страницу', { type: 'info' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const disconnectGoogle = async () => {
    if (!window.confirm('Отключить Gmail от этого ящика рассылки? Google-аккаунт CRM это не затронет.')) return
    try {
      await disconnectMailboxGoogle(mailbox.id)
      show('Gmail отключён', { type: 'success' })
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const remove = async () => {
    if (!window.confirm(`Удалить ящик «${mailbox.login || mailbox.name}» из рассылки?`)) return
    try {
      await deleteMailbox(mailbox.id)
      show('Ящик удалён', { type: 'success' })
      onDeleted?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  const transport = s.transport || 'smtp'

  const testConn = async () => {
    setBusy(true)
    setConn(null)
    try {
      setConn(await testMailboxConnection(mailbox.id))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  const testEmail = async () => {
    setBusy(true)
    try {
      await sendMailboxTestEmail(mailbox.id, testTo)
      show('Пробное письмо отправлено — проверьте ящик', { type: 'success' })
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {mailbox.campaigns?.length > 0 && (
          <div style={{ fontSize: 12.5, color: '#5A6573' }}>С этой почты идут: <b>{mailbox.campaigns.join(', ')}</b></div>
        )}
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
                Письма уходят через Gmail по HTTPS — работает на любом хостинге. Новый Gmail сначала добавьте в «Test users»
                проекта Google (как janisozalins@gmail.com). Пароль приложения ниже нужен только для проверки ответов по IMAP.
              </div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: mailbox.gmail_connected ? '#0E9F6E' : '#8A93A0' }}>
                {mailbox.gmail_connected ? `Подключён: ${mailbox.gmail_connected}` : 'Gmail ещё не подключён'}
                {mailbox.gmail_connected && !mailbox.can_read && (
                  <div style={{ marginTop: 6, color: '#B45309', fontWeight: 600 }}>
                    Чтобы видеть переписку во вкладке «Почта» и ловить ответы, нажмите «Подключить другой Gmail», войдите в этот же аккаунт и разрешите чтение писем.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button className="btn-ghost" onClick={connectGoogle}>{mailbox.gmail_connected ? 'Подключить другой Gmail' : 'Подключить Gmail'}</button>
                {mailbox.gmail_connected && <button className="btn-ghost" onClick={disconnectGoogle}>Отключить</button>}
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
                    disabled={k === 'password' && mailbox.password_from_env}
                    placeholder={k === 'password' && mailbox.password_from_env ? 'задан в MAIL_PASSWORD на сервере' : ''}
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
            <Switch size="sm" checked={!!s.auto_limit} onChange={e => set('auto_limit', e.target.checked)} /> Автоматический разгон и защита от бана
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <Switch size="sm" checked={!!s.weekdays_only} onChange={e => set('weekdays_only', e.target.checked)} /> Только будни
          </label>
        </div>
        <div style={{ fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
          Для Яндекса и Gmail нужен не обычный пароль, а «пароль приложения» из настроек безопасности почты.
          {s.auto_limit && <><br />Разгон: лимит этого ящика растёт сам по дням отправки — 5 → 10 → 15 → 20 (не выше «Максимума»). Лимит общий на все направления этой почты. Возвратов больше 4% за неделю — темп вдвое ниже, больше 8% — направления этой почты остановятся сами, придёт сообщение в Telegram и задача.</>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={save} disabled={busy}>Сохранить</button>
          <div style={{ flex: 1 }} />
          {mailbox.id !== 'main' && <button className="btn-ghost" onClick={remove} style={{ color: '#E0473B' }}>Удалить ящик</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={sectionTitle}>Проверка</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn-ghost" onClick={testConn} disabled={busy}>Проверить подключение</button>
          {conn && (
            <span style={{ fontSize: 12.5, color: '#5A6573' }}>
              Отправка: <b style={{ color: conn.smtp === 'ok' ? '#0E9F6E' : '#E0473B' }}>{conn.smtp}</b>
              {conn.imap && <> · Ответы (IMAP): <b style={{ color: conn.imap === 'ok' ? '#0E9F6E' : '#E0473B' }}>{conn.imap}</b></>}
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

const chip = (active) => ({
  padding: '7px 13px', borderRadius: 99, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-sys)',
  border: active ? '1px solid #1366F0' : '1px solid rgba(14,23,38,0.12)',
  background: active ? 'rgba(19,102,240,0.1)' : 'rgba(255,255,255,0.7)', color: active ? '#1366F0' : '#5A6573',
  display: 'inline-flex', alignItems: 'center', gap: 7,
})

function SettingsPage({ campaign, mailboxes, onSaved, onCampaignDeleted }) {
  const { show } = useToast()
  const [section, setSection] = useState(campaign ? 'campaign' : 'mail')
  const [mid, setMid] = useState(campaign?.mailbox_id || 'main')
  const mailbox = mailboxes.find(m => m.id === mid) || mailboxes[0]

  const addMailbox = async () => {
    try {
      const mb = await createMailbox({})
      show('Ящик добавлен — подключите к нему Gmail', { type: 'success' })
      setMid(mb.id)
      onSaved?.()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SlidingTabs options={[{ key: 'campaign', label: 'Направление и письмо' }, { key: 'mail', label: 'Почта' }]} value={section} onChange={setSection} />
      {section === 'campaign' && (campaign
        ? <CampaignSettings key={campaign.id} campaign={campaign} mailboxes={mailboxes} onSaved={onSaved} onDeleted={onCampaignDeleted} />
        : <div className="card" style={{ padding: 24, color: '#8A93A0', fontSize: 13 }}>Выберите направление вверху страницы — у каждого своё письмо и своя почта.</div>)}
      {section === 'mail' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {mailboxes.map(m => (
              <button key={m.id} onClick={() => setMid(m.id)} style={chip(m.id === mailbox?.id)}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: m.configured ? '#0E9F6E' : '#C4CAD4' }} />
                {m.login || m.name}
              </button>
            ))}
            <button onClick={addMailbox} style={{ ...chip(false), borderStyle: 'dashed' }}>+ Почта</button>
          </div>
          {mailbox && <MailboxSettings key={mailbox.id + (mailbox.gmail_connected || '')} mailbox={mailbox} onSaved={onSaved}
            onDeleted={() => { setMid('main'); onSaved?.() }} />}
        </>
      )}
    </div>
  )
}

// ---------------- Поставщики (ответы направлений «закупка») ----------------
const SUP_STAGES = {
  interested: { label: 'Интерес', color: '#0E9F6E', bg: 'rgba(14,159,110,0.12)' },
  negotiation: { label: 'Переговоры', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  deal: { label: 'Работаем', color: '#047857', bg: 'rgba(4,120,87,0.16)' },
  refused: { label: 'Отказ', color: '#8A93A0', bg: 'rgba(14,23,38,0.05)' },
}

function SupplierCard({ s, onChange, onRemove }) {
  const { show } = useToast()
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState(s.phone || '')
  const st = SUP_STAGES[s.stage] || SUP_STAGES.interested

  const patch = async (data) => {
    try {
      onChange(await updateSupplier(s.id, data))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 15, color: '#0E1726' }}>{s.company}</div>
          <CampaignTag name={s.product} kind="purchase" />
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 4 }}>{[s.contact_name, s.email, s.city, s.site].filter(Boolean).join(' · ')}</div>
        </div>
        <Select value={s.stage} onChange={e => patch({ stage: e.target.value })}
          style={{ alignSelf: 'flex-start', border: 'none', background: st.bg, color: st.color, borderRadius: 99, padding: '5px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {Object.entries(SUP_STAGES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
        </Select>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => phone !== (s.phone || '') && patch({ phone })}
          placeholder="Телефон" style={{ ...inputStyle, width: 180 }} />
        <a className="btn-ghost" href={gmailLink('', s.email)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Переписка в Gmail ↗</a>
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} title="Убрать из списка" style={{ border: 'none', background: 'transparent', color: '#C4CAD4', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Заметка: цена, условия, договорённости…"
          onKeyDown={e => { if (e.key === 'Enter' && note.trim()) { patch({ note }); setNote('') } }} style={inputStyle} />
        <button className="btn-ghost" disabled={!note.trim()} onClick={() => { patch({ note }); setNote('') }}>Добавить</button>
      </div>
      {(s.notes || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {s.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 12.5, color: '#0E1726', background: '#F7F8FA', borderRadius: 10, padding: '8px 10px', whiteSpace: 'pre-wrap' }}>
              {n.text}
              <div style={{ fontSize: 11, color: '#A6AEB8', marginTop: 3 }}>{n.author} · {fmtTs(n.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Suppliers({ campaignId }) {
  const { show } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('')

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      getSuppliers({ campaign_id: campaignId || '', stage, q })
        .then(r => setItems(Array.isArray(r) ? r : []))
        .catch(e => show('Ошибка загрузки: ' + e.message, { type: 'error' }))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, stage, q])

  const remove = async (s) => {
    if (!window.confirm(`Убрать «${s.company}» из поставщиков?`)) return
    try {
      await deleteSupplier(s.id)
      setItems(list => list.filter(x => x.id !== s.id))
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['', 'Все'], ...Object.entries(SUP_STAGES).map(([k, x]) => [k, x.label])].map(([k, l]) => (
          <button key={k} onClick={() => setStage(k)} style={chip(stage === k)}>{l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск: компания, товар, email" style={{ ...inputStyle, width: 240 }} />
      </div>
      <div style={{ fontSize: 12, color: '#8A93A0' }}>
        Сюда попадают поставщики, ответившие на направления «закупка», когда во «Ответах» нажимаете «Интерес» или «Сделка».
      </div>
      {loading && <Loader padding={30} />}
      {!loading && items.length === 0 && (
        <div className="card"><EmptyState title="Поставщиков пока нет" subtitle="Здесь появятся компании, ответившие на направления «закупка» с интересом" /></div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {items.map(s => (
          <SupplierCard key={s.id} s={s} onRemove={() => remove(s)}
            onChange={upd => upd && setItems(list => list.map(x => x.id === upd.id ? upd : x))} />
        ))}
      </div>
    </div>
  )
}

// ---------------- Направления: переключатель ----------------
function NewCampaignForm({ mailboxes, onCreated, onCancel }) {
  const { show } = useToast()
  const [f, setF] = useState({ name: '', kind: 'sale', mailbox_id: 'main' })
  const [busy, setBusy] = useState(false)

  const create = async () => {
    setBusy(true)
    try {
      const c = await createMailingCampaign(f)
      show(`Направление «${c.name}» создано — напишите для него письмо`, { type: 'success' })
      onCreated(c)
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setBusy(false)
  }

  return (
    <div className="card" style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
      <div>
        <div style={labelStyle}>Название</div>
        <input autoFocus value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="Краска — закупка" style={inputStyle} />
      </div>
      <div>
        <div style={labelStyle}>Тип</div>
        <Select value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value }))} style={inputStyle}>
          <option value="sale">Продажа товара</option>
          <option value="clients">Поиск клиентов</option>
          <option value="purchase">Закупка — ищем поставщиков</option>
        </Select>
      </div>
      <div>
        <div style={labelStyle}>С какой почты</div>
        <Select value={f.mailbox_id} onChange={e => setF(x => ({ ...x, mailbox_id: e.target.value }))} style={inputStyle}>
          {mailboxes.map(m => <option key={m.id} value={m.id}>{m.login || m.name}</option>)}
        </Select>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
        <button className="btn-primary" onClick={create} disabled={busy || !f.name.trim()}>Создать</button>
      </div>
    </div>
  )
}

function CampaignBar({ campaigns, value, onChange, onAdd }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
      <button onClick={() => onChange('')} style={chip(!value)}>Все направления</button>
      {campaigns.map(c => (
        <button key={c.id} onClick={() => onChange(c.id)} style={chip(value === c.id)}>
          <span title={c.running ? 'работает' : 'остановлено'} style={{ width: 7, height: 7, borderRadius: 99, background: c.running ? '#0E9F6E' : '#C4CAD4' }} />
          {c.name}
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c.kind === 'purchase' ? '#B45309' : c.kind === 'clients' ? '#0E9F6E' : '#8A93A0' }}>{KIND_LABEL[c.kind] || ''}</span>
          {c.replies_new > 0 && (
            <span style={{ minWidth: 16, height: 16, borderRadius: 99, background: '#0E9F6E', color: '#fff', fontSize: 10, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{c.replies_new}</span>
          )}
        </button>
      ))}
      <button onClick={onAdd} style={{ ...chip(false), borderStyle: 'dashed' }}>+ Направление</button>
    </div>
  )
}

// ---------------- Страница ----------------
const CAMPAIGN_KEY = 'mailing_campaign'

export default function Mailing() {
  const { show } = useToast()
  const [tab, setTab] = useState('overview')
  const [campaigns, setCampaigns] = useState(null)
  const [mailboxes, setMailboxes] = useState(null)
  const [campaignId, setCampaignIdRaw] = useState(() => { try { return localStorage.getItem(CAMPAIGN_KEY) || '' } catch { return '' } })
  const [state, setState] = useState(null)
  const [newReplies, setNewReplies] = useState([])
  const [contactsGroup, setContactsGroup] = useState('')
  const [adding, setAdding] = useState(false)

  const setCampaignId = (id) => {
    setCampaignIdRaw(id)
    try { localStorage.setItem(CAMPAIGN_KEY, id) } catch {}
  }

  const loadCampaigns = () => getMailingCampaigns().then(list => {
    setCampaigns(list)
    // выбранное направление удалили (или его нет на этом устройстве) — показываем все
    if (campaignId && !list.some(c => c.id === campaignId)) setCampaignId('')
  }).catch(e => show('Ошибка загрузки направлений: ' + e.message, { type: 'error' }))
  const loadMailboxes = () => getMailboxes().then(setMailboxes).catch(e => show('Ошибка загрузки почты: ' + e.message, { type: 'error' }))
  const loadState = () => {
    getMailingReplies(true, campaignId).then(r => setNewReplies(Array.isArray(r) ? r : [])).catch(() => {})
    return getMailingState(campaignId).then(setState).catch(e => show('Ошибка загрузки рассылки: ' + e.message, { type: 'error' }))
  }
  const reloadAll = () => { loadState(); loadCampaigns(); loadMailboxes() }

  useEffect(() => {
    loadCampaigns()
    loadMailboxes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setState(null)
    loadState()
    const t = setInterval(() => { loadState(); loadCampaigns() }, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  const campaign = (campaigns || []).find(c => c.id === campaignId) || null
  const hasPurchase = (campaigns || []).some(c => c.kind === 'purchase')
  const loginFor = (cid) => {
    const c = (campaigns || []).find(x => x.id === cid)
    const ids = c?.mailbox_ids?.length ? c.mailbox_ids : [c?.mailbox_id || 'main']
    return (mailboxes || []).filter(m => ids.includes(m.id)).map(m => m.login).filter(Boolean).join(', ')
  }
  const ready = state && campaigns && mailboxes

  return (
    <div>
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 20, color: '#0E1726' }}>Рассылка</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Письма по направлениям с дневным лимитом, напоминанием и проверкой ответов</div>
        </div>
        <SlidingTabs options={tabsWith(state?.replies_new, hasPurchase)} value={tab} onChange={t => { setContactsGroup(''); setTab(t) }} />
      </div>

      {campaigns && (
        <CampaignBar campaigns={campaigns} value={campaignId} onChange={id => { setCampaignId(id); setAdding(false) }} onAdd={() => setAdding(a => !a)} />
      )}
      {adding && mailboxes && (
        <div style={{ marginBottom: 16 }}>
          <NewCampaignForm mailboxes={mailboxes} onCancel={() => setAdding(false)}
            onCreated={c => { setAdding(false); loadCampaigns(); setCampaignId(c.id); setTab('settings') }} />
        </div>
      )}

      {!ready && <Loader padding={40} />}
      {ready && (
        <>
          {tab === 'overview' && <Overview state={state} campaignId={campaignId} reload={() => { loadState(); loadCampaigns() }}
            onGoSettings={() => setTab('settings')} onGoReplies={() => setTab('replies')}
            onGoContacts={g => { setContactsGroup(g); setTab('contacts') }} replies={newReplies} />}
          {tab === 'replies' && <Replies key={campaignId} campaignId={campaignId} loginFor={loginFor} onChanged={() => { loadState(); loadCampaigns() }} />}
          {tab === 'contacts' && <Contacts key={campaignId + contactsGroup} campaignId={campaignId} campaignName={campaign?.name}
            onChanged={loadState} groups={state.groups} loginFor={loginFor} initialGroup={contactsGroup} />}
          {tab === 'suppliers' && <Suppliers campaignId={campaign?.kind === 'purchase' ? campaignId : ''} />}
          {tab === 'settings' && <SettingsPage key={campaignId} campaign={campaign} mailboxes={mailboxes} onSaved={reloadAll}
            onCampaignDeleted={() => { setCampaignId(''); reloadAll() }} />}
        </>
      )}
    </div>
  )
}
