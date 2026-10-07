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
  { key: 'letter', label: 'Письмо' },
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

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.new
  return (
    <span style={{ padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div className="card" style={{ padding: '14px 16px', minWidth: 140, flex: 1 }}>
      <div style={{ fontSize: 12, color: '#8A93A0' }}>{label}</div>
      <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 22, color: '#0E1726', marginTop: 4 }}>{value}</div>
      {hint && <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

// ---------------- Обзор ----------------
function Overview({ state, reload, onGoSettings, onGoReplies, replies }) {
  const { show } = useToast()
  const [busy, setBusy] = useState(false)

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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!state.configured && (
        <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#5A6573' }}>Почта ещё не подключена — укажите адрес и пароль приложения в настройках.</div>
          <button className="btn-ghost" onClick={onGoSettings}>Открыть настройки</button>
        </div>
      )}

      <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: 99, background: state.running ? '#0E9F6E' : '#C4CAD4', boxShadow: state.running ? '0 0 0 4px rgba(14,159,110,0.15)' : 'none' }} />
          <div>
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 16, color: '#0E1726' }}>{state.state}</div>
            {state.next_at && <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Следующее действие в {state.next_at} (Мск)</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={checkInbox} disabled={busy}>Проверить входящие</button>
          <button
            className="btn-primary"
            onClick={toggle}
            disabled={busy || (!state.running && !state.configured)}
            style={state.running ? { background: '#E0473B' } : undefined}
          >
            {state.running ? 'Остановить' : 'Запустить'}
          </button>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="card" style={{ padding: 18, border: '1px solid rgba(14,159,110,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ ...sectionTitle, marginBottom: 0 }}>🔔 Новые ответы: {replies.length}</div>
            <button className="btn-ghost" onClick={onGoReplies}>Разобрать →</button>
          </div>
          {replies.slice(0, 3).map(c => (
            <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(14,23,38,0.05)', fontSize: 13 }}>
              <b style={{ color: '#0E1726' }}>{c.company || c.email}</b>
              <span style={{ color: '#5A6573' }}> — {(c.reply_snippet || 'ответ без текста').slice(0, 140)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Stat label="Отправлено сегодня" value={`${state.sent_today} / ${state.limit}`} hint="дневной лимит" />
        <Stat label="В очереди" value={state.queue_new} hint={state.queue_follow ? `+ ${state.queue_follow} напоминаний` : 'новых адресов'} />
        <Stat label="Контактов" value={state.total} hint={`с email: ${state.with_email}`} />
        <Stat label="Ответили" value={state.groups?.answered ?? 0} hint={counts.deal ? `сделок: ${counts.deal}` : (state.with_email ? `${Math.round(100 * (state.groups?.answered || 0) / Math.max(1, (state.total - (counts.new || 0))))}% от отправленных` : undefined)} />
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={sectionTitle}>По статусам</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.keys(STATUS).filter(k => counts[k]).map(k => (
            <span key={k} style={{ padding: '6px 12px', borderRadius: 10, background: STATUS[k].bg, color: STATUS[k].color, fontSize: 12.5, fontWeight: 600 }}>
              {STATUS[k].label}: {counts[k]}
            </span>
          ))}
          {!Object.values(counts).some(Boolean) && <span style={{ fontSize: 13, color: '#A6AEB8' }}>Контактов пока нет</span>}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={sectionTitle}>Журнал</div>
        {(state.log || []).length === 0 && <div style={{ fontSize: 13, color: '#A6AEB8' }}>Пока пусто</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(state.log || []).map(l => (
            <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '120px 110px 1fr', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(14,23,38,0.05)', fontSize: 12.5, alignItems: 'baseline' }}>
              <span style={{ color: '#A6AEB8' }}>{(l.ts || '').replace('T', ' ').slice(5, 16)}</span>
              <span style={{ color: l.ok ? '#0E9F6E' : '#E0473B', fontWeight: 600 }}>{l.kind}</span>
              <span style={{ color: '#5A6573', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[l.company, l.email].filter(Boolean).join(' · ')}{l.detail ? ` — ${l.detail}` : ''}
              </span>
            </div>
          ))}
        </div>
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

function Contacts({ onChanged, groups = {}, login }) {
  const { show } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [group, setGroup] = useState('')
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
                  <div style={labelStyle}>{k === 'login' && transport === 'gmail_api' ? 'Ваш Gmail' : k === 'password' && transport === 'gmail_api' ? 'Пароль приложения (для IMAP)' : l}</div>
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
            <input type="checkbox" checked={!!s.weekdays_only} onChange={e => set('weekdays_only', e.target.checked)} /> Только будни
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!s.followup_enabled} onChange={e => set('followup_enabled', e.target.checked)} /> Отправлять напоминание
          </label>
        </div>
        <div style={{ fontSize: 12, color: '#8A93A0', lineHeight: 1.6 }}>
          Для Яндекса и Gmail нужен не обычный пароль, а «пароль приложения» из настроек безопасности почты.
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

// ---------------- Страница ----------------
export default function Mailing() {
  const { show } = useToast()
  const [tab, setTab] = useState('overview')
  const [state, setState] = useState(null)
  const [settings, setSettings] = useState(null)
  const [newReplies, setNewReplies] = useState([])

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
        <SlidingTabs options={tabsWith(state?.replies_new)} value={tab} onChange={setTab} />
      </div>

      {(!state || !settings) && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}
      {state && settings && (
        <>
          {tab === 'overview' && <Overview state={state} reload={loadState} onGoSettings={() => setTab('settings')} onGoReplies={() => setTab('replies')} replies={newReplies} />}
          {tab === 'replies' && <Replies login={settings.login} onChanged={loadState} />}
          {tab === 'contacts' && <Contacts onChanged={loadState} groups={state.groups} login={settings.login} />}
          {tab === 'letter' && <Letter key={settings.body} settings={settings} onSaved={reloadAll} />}
          {tab === 'settings' && <Settings settings={settings} onSaved={reloadAll} />}
        </>
      )}
    </div>
  )
}
