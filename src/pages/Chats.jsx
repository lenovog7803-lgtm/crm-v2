import { useState, useEffect, useRef } from 'react'
import { getMailboxes, getChats, getChat, replyChat, newChat, draftChat, downloadChatAttachment, startMailboxGoogle } from '../api'
import { useToast } from '../components/Toast'
import { useIsMobile } from '../hooks/useIsMobile'
import { Loader } from '../components/Loader'
import SearchField from '../components/SearchField'
import { SlidingTabs } from '../components/SlidingTabs'

// «Чаты» — вся переписка выбранного ящика Gmail в виде мессенджера:
// слева ящики и переписки, справа пузырьки и поле ответа. Логика — backend/mailing.py (/mailing/chats).

const BOX_KEY = 'chats.mailbox'
const FOLDERS = [{ key: 'all', label: 'Все' }, { key: 'inbox', label: 'Входящие' }, { key: 'sent', label: 'Отправленные' }]
const COLORS = ['#1366f0', '#0e9f6e', '#d97706', '#7c3aed', '#e0473b', '#0891b2', '#db2777']
const colorOf = (s = '') => COLORS[[...s].reduce((a, ch) => a + ch.charCodeAt(0), 0) % COLORS.length]
const initials = (name = '') => (name.replace(/[<>"@].*$/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('') || '?').toUpperCase()
const fmtSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} МБ` : `${Math.max(1, Math.round(n / 1024))} КБ`
const sameDay = (a, b) => a.slice(0, 10) === b.slice(0, 10)

function whenShort(iso) {
  if (!iso) return ''
  const today = new Date().toISOString().slice(0, 10)
  if (iso.slice(0, 10) === today) return iso.slice(11, 16)
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}`
}
function dayLabel(iso) {
  const d = new Date(iso.slice(0, 10))
  const today = new Date(new Date().toISOString().slice(0, 10))
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Сегодня'
  if (diff === 1) return 'Вчера'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) })
}

function Avatar({ name, email, size = 42 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: colorOf(email || name), color: '#fff', fontWeight: 700, fontSize: size * 0.38, fontFamily: 'var(--font-sys)' }}>
      {initials(name || email)}
    </span>
  )
}

const chip = (on) => ({
  border: 'none', cursor: 'pointer', borderRadius: 99, padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  background: on ? 'var(--bg-1366f0)' : 'rgba(118,118,128,0.12)', color: on ? '#fff' : 'var(--ink)', whiteSpace: 'nowrap',
})

function Composer({ onSend, placeholder = 'Сообщение…', autoFocus, draft = '', extra }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const ref = useRef(null)
  // черновик от ИИ подставляем в пустое поле — свой набранный текст не затираем
  useEffect(() => {
    if (!draft) return
    setText(t => t || draft)
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 260) + 'px' } })
  }, [draft])
  const isDraft = !!draft && text === draft
  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await onSend(text.trim())
      setText('')
      if (ref.current) ref.current.style.height = 'auto'
    } catch { /* ошибку уже показал родитель */ }
    setSending(false)
  }
  return (
    <>
    {(isDraft || extra) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px 0', fontSize: 12, color: 'var(--fg-5856d6)', fontWeight: 600 }}>
        {isDraft && <span>✍️ Черновик от ИИ — проверь и отправь</span>}
        <span style={{ flex: 1 }} />
        {extra}
      </div>
    )}
    <div className="composer">
      <textarea ref={ref} data-plain value={text} onChange={e => setText(e.target.value)} rows={1} placeholder={placeholder} autoFocus={autoFocus}
        onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 260) + 'px' }}
        // как в мессенджере: Enter — отправить, Shift + Enter — новая строка
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
      <button className="composer-send" disabled={sending || !text.trim()} onClick={send} aria-label="Отправить" title="Отправить (Enter)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
      </button>
    </div>
    </>
  )
}

function ChatView({ mailboxId, chat, onBack, onSent }) {
  const { show } = useToast()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const endRef = useRef(null)

  const load = (silent = false) => {
    if (!silent) setErr('')
    getChat(mailboxId, chat.id).then(setData).catch(e => { if (!silent) setErr(e.message) })
  }
  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load(true) }, 30000)
    return () => clearInterval(t)
  }, [mailboxId, chat.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const count = data?.messages?.length || 0
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [count])

  const send = async (text) => {
    try {
      await replyChat(mailboxId, chat.id, text)
      // сразу показываем своё сообщение, Gmail отдаёт отправленное с задержкой
      const now = new Date()
      const iso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      setData(d => d && { ...d, messages: [...d.messages, { id: 'local-' + now.getTime(), from_me: true, text, date: iso, attachments: [] }] })
      onSent?.(text)
      setDraft('')
      setTimeout(() => load(true), 2500)
    } catch (e) {
      show('Не отправилось: ' + e.message, { type: 'error' })
      throw e
    }
  }
  const download = (m, a) => downloadChatAttachment(mailboxId, m.id, a.index, a.name).catch(e => show('Ошибка: ' + e.message, { type: 'error' }))
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState('')
  useEffect(() => { if (data?.draft) setDraft(data.draft) }, [data?.draft])
  const makeDraft = async () => {
    setDrafting(true)
    try { setDraft((await draftChat(mailboxId, chat.id)).draft) } catch (e) { show(e.message, { type: 'error' }) }
    setDrafting(false)
  }
  const lastTheirs = data?.messages?.length && !data.messages[data.messages.length - 1].from_me
  const draftBtn = data?.can_draft && lastTheirs && !draft && (
    <button onClick={makeDraft} disabled={drafting} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0,
      fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--fg-5856d6)' }}>{drafting ? 'Пишу черновик…' : '✍️ Черновик ответа'}</button>
  )

  const name = data?.peer_name || chat.peer_name
  const addr = data?.peer_email || chat.peer_email
  const msgs = data?.messages || []
  return (
    <div className="ios-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden',
      height: onBack ? 'calc(100dvh - 150px)' : 'calc(100dvh - 190px)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '0.5px solid rgba(var(--sep-rgb), 0.18)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {onBack && <button className="ios-sheet-close" onClick={onBack} aria-label="Назад" style={{ fontSize: 20 }}>‹</button>}
        <Avatar name={name} email={addr} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[addr !== name && addr, data?.subject || chat.subject].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(var(--paper-rgb), 0.55)', overflowY: 'auto' }}>
        {!data && !err && <Loader padding={20} state="listening" label="Загрузка переписки…" />}
        {err && <div style={{ color: 'var(--fg-e0473b)', fontSize: 13 }}>{err}</div>}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1]
          const newDay = !prev || !sameDay(prev.date || '', m.date || '')
          const grouped = prev && !newDay && prev.from_me === m.from_me
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.from_me ? 'flex-end' : 'flex-start', marginTop: grouped ? 0 : 8 }}>
              {newDay && m.date && (
                <div style={{ alignSelf: 'center', margin: '6px 0 10px', padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                  background: 'rgba(118,118,128,0.12)', color: 'var(--text-3)' }}>{dayLabel(m.date)}</div>
              )}
              <div className={`bubble ${m.from_me ? 'bubble--me' : 'bubble--them'}`}>
                {m.text || '(без текста)'}
                {m.attachments?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {m.attachments.map(a => (
                      <button key={a.index} onClick={() => download(m, a)} className="btn-chip" style={{ border: 'none', background: m.from_me ? 'rgba(255,255,255,0.2)' : 'rgba(var(--paper-rgb), 0.8)', color: m.from_me ? '#fff' : 'var(--fg-1366f0)' }}>
                        📎 {a.name} · {fmtSize(a.size)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bubble-meta">{(m.date || '').slice(11, 16)}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <Composer onSend={send} draft={draft} extra={draftBtn} />
    </div>
  )
}

function NewChat({ mailboxId, onBack, onSent }) {
  const { show } = useToast()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const field = { border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: 'inherit', color: 'var(--ink)', flex: 1, minWidth: 0 }
  const row = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '0.5px solid rgba(var(--sep-rgb), 0.18)' }
  const send = async (text) => {
    try {
      await newChat({ mailbox_id: mailboxId, to, subject, text })
      show('Письмо отправлено', { type: 'success' })
      onSent()
    } catch (e) {
      show('Не отправилось: ' + e.message, { type: 'error' })
      throw e
    }
  }
  return (
    <div className="ios-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden',
      height: onBack ? 'calc(100dvh - 150px)' : 'calc(100dvh - 190px)' }}>
      <div style={{ ...row, fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-sys)' }}>
        {onBack && <button className="ios-sheet-close" onClick={onBack} aria-label="Назад" style={{ fontSize: 20 }}>‹</button>}
        Новое письмо
      </div>
      <label style={row}><span style={{ color: 'var(--text-3)', fontSize: 14 }}>Кому:</span>
        <input data-plain type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="email@компания.by" style={field} autoFocus /></label>
      <label style={row}><span style={{ color: 'var(--text-3)', fontSize: 14 }}>Тема:</span>
        <input data-plain value={subject} onChange={e => setSubject(e.target.value)} placeholder="Без темы" style={field} /></label>
      <div style={{ flex: 1, background: 'rgba(var(--paper-rgb), 0.55)' }} />
      <Composer onSend={send} placeholder="Текст письма…" />
    </div>
  )
}

export default function Chats() {
  const { show } = useToast()
  const isMobile = useIsMobile()
  const [boxes, setBoxes] = useState(null)
  const [boxId, setBoxId] = useState(() => localStorage.getItem(BOX_KEY) || '')
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('all')
  const [chats, setChats] = useState([])
  const [next, setNext] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(null)  // чат, 'new' или null

  const loadBoxes = () => getMailboxes().then(list => {
    const ok = (list || []).filter(m => m.transport === 'gmail_api' && m.gmail_connected)
    setBoxes(ok)
    setBoxId(cur => ok.some(m => m.id === cur) ? cur : (ok[0]?.id || ''))
    return ok
  }).catch(e => { setBoxes(b => b || []); show('Ошибка загрузки почт: ' + e.message, { type: 'error' }) })
  useEffect(() => {
    loadBoxes()
    // вернулись из вкладки входа Google — перепроверяем почты и перечитываем чаты
    const onFocus = () => loadBoxes()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const relogin = async (m) => {
    try {
      const r = await startMailboxGoogle(m.id)
      window.open(r.auth_url, '_blank')
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
  }
  const box = (boxes || []).find(m => m.id === boxId)
  const expired = !!box?.login_expired

  // поиск — по паузе в наборе, а не на каждую букву (каждый запрос идёт в Gmail)
  useEffect(() => { const t = setTimeout(() => setQuery(q.trim()), 500); return () => clearTimeout(t) }, [q])

  const load = (silent = false) => {
    if (!boxId || expired) return
    if (!silent) { setLoading(true); setErr('') }
    getChats(boxId, query, '', folder)
      .then(r => { setChats(r.chats || []); setNext(r.next_page || ''); setErr('') })
      .catch(e => { if (!silent) { setChats([]); setErr(e.message) } })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    if (boxId) localStorage.setItem(BOX_KEY, boxId)
    load()
    const t = setInterval(() => { if (!document.hidden) load(true) }, 60000)
    return () => clearInterval(t)
  }, [boxId, query, folder, expired]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setOpen(null) }, [boxId])

  const more = () => getChats(boxId, query, next, folder)
    .then(r => { setChats(list => [...list, ...(r.chats || []).filter(c => !list.some(x => x.id === c.id))]); setNext(r.next_page || '') })
    .catch(e => show('Ошибка: ' + e.message, { type: 'error' }))

  const openChat = (c) => {
    setOpen(c)
    if (c.unread) setChats(list => list.map(x => x.id === c.id ? { ...x, unread: false } : x))
  }
  const onSent = (text) => setChats(list => list.map(x => x.id === open?.id
    ? { ...x, snippet: text, last_from_me: true, date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) } : x))

  if (!boxes) return <Loader />
  if (boxes.length === 0) {
    return (
      <div className="ios-widget" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
        Чтобы переписываться здесь, подключите Gmail в «Рассылка → Настройки → Почта» и разрешите чтение писем.
      </div>
    )
  }

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {(boxes.length > 1 || expired) && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {boxes.map(m => (
            <button key={m.id} onClick={() => (m.login_expired && m.id === boxId ? relogin(m) : setBoxId(m.id))}
              title={m.login_expired ? 'Gmail вышел из аккаунта — нажмите, чтобы войти заново' : undefined}
              style={m.login_expired ? { ...chip(false), background: m.id === boxId ? 'var(--fg-e0473b)' : 'rgba(224,71,59,0.12)', color: m.id === boxId ? '#fff' : 'var(--fg-e0473b)' } : chip(m.id === boxId)}>
              {m.login_expired && '⚠ '}{m.login || m.name}
            </button>
          ))}
        </div>
      )}
      {expired && (
        <div className="ios-widget" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-e0473b)' }}>Gmail {box.login} вышел из аккаунта</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>Google выкидывает раз в неделю. Войдите заново — после входа вернитесь в эту вкладку, чаты загрузятся сами.</div>
          <button onClick={() => relogin(box)} style={{ ...chip(true), background: 'var(--fg-e0473b)' }}>Войти в {box.login} →</button>
        </div>
      )}
      {!expired && <SlidingTabs options={FOLDERS} value={folder} onChange={setFolder} />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchField value={q} onChange={setQ} placeholder="Поиск по почте" style={{ flex: 1, minWidth: 0 }} />
        <button onClick={() => setOpen('new')} aria-label="Новое письмо" title="Новое письмо"
          style={{ ...chip(true), padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          {!isMobile && 'Написать'}
        </button>
      </div>
      {!expired && loading && <Loader padding={30} />}
      {!expired && !loading && err && <div className="ios-widget" style={{ padding: 20, color: 'var(--fg-e0473b)', fontSize: 13, lineHeight: 1.45 }}>{err}</div>}
      {!expired && !loading && !err && chats.length === 0 && (
        <div className="ios-widget" style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          {query ? 'Ничего не нашлось' : 'Переписок пока нет'}
        </div>
      )}
      {!expired && !loading && chats.length > 0 && (
        <div className="ios-list">
          {chats.map(c => (
            <button key={c.id} onClick={() => openChat(c)} className={`mail-row${c.id === open?.id ? ' is-active' : ''}`} style={{ alignItems: 'center' }}>
              <Avatar name={c.peer_name} email={c.peer_email} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: c.unread ? 700 : 600, fontSize: 15, color: 'var(--ink)', flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.peer_name || c.peer_email}</span>
                  <span style={{ fontSize: 13, color: c.unread ? 'var(--fg-1366f0)' : 'var(--text-3)', fontWeight: c.unread ? 700 : 400, flexShrink: 0 }}>{whenShort(c.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--text-2b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.last_from_me && <span style={{ color: 'var(--text-3)' }}>Вы: </span>}
                    {c.snippet || c.subject}
                  </span>
                  {c.unread && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bg-1366f0)', flexShrink: 0 }} />}
                </div>
                {c.campaign && (
                  <span style={{ display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: 'rgba(88,86,214,0.12)', color: 'var(--fg-5856d6)' }}>Рассылка · {c.campaign}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && next && <button className="btn-ghost" onClick={more} style={{ alignSelf: 'center' }}>Показать ещё</button>}
    </div>
  )

  const back = isMobile ? () => setOpen(null) : null
  const right = open === 'new'
    ? <NewChat key={'new' + boxId} mailboxId={boxId} onBack={back} onSent={() => { setOpen(null); setTimeout(() => load(true), 2500) }} />
    : open
      ? <ChatView key={boxId + open.id} mailboxId={boxId} chat={open} onBack={back} onSent={onSent} />
      : <div className="ios-widget" style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>Выберите чат слева</div>

  if (isMobile) return open ? right : list
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ maxHeight: 'calc(100dvh - 190px)', overflowY: 'auto', paddingRight: 4 }}>{list}</div>
      {right}
    </div>
  )
}
