import { useState, useEffect, useRef } from 'react'
import { OUTCOMES, LOST_REASONS, DATE_PRESETS } from '../../constants/leads'
import { OutcomeIcon } from './OutcomeIcon'
import { SwapText } from '../Transitions'
import Select from '../Select'
import DateInput from '../DateInput'
import { localDateTime } from './saveCall'
import { getProposalText, getWhatsAppKpUrl, getTelegramCustomUrl, getEmailKpUrl } from './commercialProposal'

const labelStyle = { fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 12, display: 'block' }

export default function CallOutcomeBar({ lead, onSave, saving, columns = 3 }) {
  const [outcome, setOutcome] = useState(null)
  const [comment, setComment] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [nextCall, setNextCall] = useState('')
  const [error, setError] = useState('')
  const [copiedKp, setCopiedKp] = useState(false)
  const [kpChannel, setKpChannel] = useState('whatsapp')
  const [kpTarget, setKpTarget] = useState('')

  useEffect(() => {
    setOutcome(null)
    setComment('')
    setLostReason('')
    setNextCall('')
    setError('')
    setKpChannel('whatsapp')
    setKpTarget(lead?.phone || '')
  }, [lead?.id])

  const cfg = OUTCOMES.find(o => o.id === outcome) || null
  const showDateBlock = outcome && outcome !== 'no_answer' && outcome !== 'won' && outcome !== 'lost'

  const setPreset = (days) => setNextCall(localDateTime(days))

  // onSave возвращает текст ошибки, если звонок не записался
  const send = async (payload) => {
    setError('')
    const err = await onSave(payload)
    if (err) setError(err)
  }

  const handleSave = () => {
    if (saving) return
    if (!outcome || !cfg) { setError('Выберите результат звонка'); return }
    if (cfg?.needsComment && !comment.trim()) { setError('Напишите комментарий'); return }
    if (cfg?.needsReason && !lostReason) { setError('Укажите причину отказа'); return }
    send({
      outcome,
      comment: comment.trim(),
      lost_reason: cfg?.needsReason ? lostReason : undefined,
      next_call: nextCall ? new Date(nextCall).toISOString() : undefined,
    })
  }

  // «Не взял трубку» дописывать нечем — сохраняем сразу, одним нажатием
  const pick = (id) => {
    if (saving) return
    setOutcome(id); setError('')
    if (id === 'no_answer') send({ outcome: id, comment: '' })
  }

  // Клавиши: 1–6 — результат, Enter — сохранить (в поле комментария — ⌘/Ctrl+Enter)
  const keys = useRef({})
  keys.current = { pick, handleSave }
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || document.querySelector('.ios-alert, .modal-overlay')) return
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]')
      if (e.key === 'Enter' && (!typing || e.metaKey || e.ctrlKey)) {
        if (e.target.closest?.('button, a')) return   // Enter на кнопке — её собственное нажатие
        e.preventDefault(); keys.current.handleSave(); return
      }
      if (typing || e.metaKey || e.ctrlKey) return
      const o = OUTCOMES[Number(e.key) - 1]
      if (o) { e.preventDefault(); keys.current.pick(o.id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="card call-sheet" style={{ padding: 20 }}>
      <span style={labelStyle}>Результат звонка</span>
      <div className="call-outcomes" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8, marginBottom: 16 }}>
        {OUTCOMES.map((o, i) => (
          <button
            key={o.id}
            onClick={() => pick(o.id)}
            className="call-outcome"
            aria-pressed={outcome === o.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderRadius: 12,
              background: outcome === o.id ? 'rgba(var(--rgb-19-102-240), 0.1)' : 'rgba(var(--ink-rgb), 0.035)',
              boxShadow: outcome === o.id ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.45)' : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: outcome === o.id ? 'var(--fg-1366f0)' : 'var(--text-3)', transition: 'color 0.15s var(--ease)',
            }}><OutcomeIcon id={o.id} size={17} /></span>
            <span style={{ fontFamily: 'var(--font-sys)', fontSize: 14, fontWeight: outcome === o.id ? 600 : 400, color: outcome === o.id ? 'var(--fg-1366f0)' : 'var(--ink)' }}>
              {o.label}
            </span>
            <kbd className="call-key">{i + 1}</kbd>
          </button>
        ))}
      </div>

      {cfg?.needsReason && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Причина отказа</span>
          <Select value={lostReason} onChange={e => { setLostReason(e.target.value); setError('') }} className="form-input" style={{ width: '100%', background: 'var(--fill)' }}>
            <option value="">Выберите причину…</option>
            {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      )}

      {outcome === 'quote' && (
        <div style={{
          marginBottom: 16,
          padding: '13px 15px',
          borderRadius: 14,
          background: 'rgba(var(--rgb-19-102-240), 0.05)',
          border: '1px solid rgba(var(--rgb-19-102-240), 0.18)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              Куда отправить КП:
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 6, background: 'rgba(var(--rgb-19-102-240), 0.1)', color: 'var(--fg-1366f0)' }}>
              {lead?.funnel === 'WB_OZON' ? 'WB / Ozon' : 'B2B РФ'}
            </span>
          </div>

          {/* Переключатель каналов */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => { setKpChannel('whatsapp'); setKpTarget(lead?.phone || '') }}
              className="call-pill"
              style={{
                background: kpChannel === 'whatsapp' ? 'rgba(var(--rgb-19-102-240), 0.16)' : 'rgba(var(--ink-rgb), 0.04)',
                color: kpChannel === 'whatsapp' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: kpChannel === 'whatsapp' ? 600 : 400
              }}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => { setKpChannel('telegram'); setKpTarget(lead?.phone || '') }}
              className="call-pill"
              style={{
                background: kpChannel === 'telegram' ? 'rgba(var(--rgb-19-102-240), 0.16)' : 'rgba(var(--ink-rgb), 0.04)',
                color: kpChannel === 'telegram' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: kpChannel === 'telegram' ? 600 : 400
              }}
            >
              Telegram
            </button>
            <button
              type="button"
              onClick={() => { setKpChannel('email'); setKpTarget(lead?.email || '') }}
              className="call-pill"
              style={{
                background: kpChannel === 'email' ? 'rgba(var(--rgb-19-102-240), 0.16)' : 'rgba(var(--ink-rgb), 0.04)',
                color: kpChannel === 'email' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: kpChannel === 'email' ? 600 : 400
              }}
            >
              Почта (Email)
            </button>
          </div>

          {/* Поле адресата — можно изменить, если дали другой контакт! */}
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              value={kpTarget}
              onChange={e => setKpTarget(e.target.value)}
              placeholder={
                kpChannel === 'whatsapp' ? 'Номер для WhatsApp (+375...)' :
                kpChannel === 'telegram' ? 'Номер (+375...) или @никнейм' :
                'Почта для КП (email@company.by)'
              }
              className="form-input"
              style={{
                width: '100%', height: 36, padding: '0 12px', fontSize: 13,
                background: 'var(--fill)', borderRadius: 10, border: '1px solid rgba(var(--ink-rgb), 0.12)', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Кнопки действия */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {kpChannel === 'whatsapp' && (
              <a
                href={getWhatsAppKpUrl(kpTarget || lead?.phone, getProposalText(lead))}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  const targetLabel = kpTarget && kpTarget !== lead?.phone ? `на ${kpTarget}` : ''
                  if (!comment) setComment(`Отправлено КП в WhatsApp ${targetLabel}`.trim())
                }}
                className="call-pill call-pill--blue"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                title="Открыть WhatsApp с уже вставленным текстом предложения"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>
                Открыть WhatsApp с КП
              </a>
            )}

            {kpChannel === 'telegram' && (
              <a
                href={getTelegramCustomUrl(kpTarget || lead?.phone)}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  navigator.clipboard?.writeText(getProposalText(lead))
                  setCopiedKp(true)
                  setTimeout(() => setCopiedKp(false), 2000)
                  const targetLabel = kpTarget && kpTarget !== lead?.phone ? `на ${kpTarget}` : ''
                  if (!comment) setComment(`Отправлено КП в Telegram ${targetLabel}`.trim())
                }}
                className="call-pill call-pill--blue"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                title="Скопировать текст КП и открыть диалог в Telegram"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.942z"/></svg>
                Открыть Telegram с КП
              </a>
            )}

            {kpChannel === 'email' && (
              <a
                href={getEmailKpUrl(kpTarget || lead?.email, lead, getProposalText(lead))}
                onClick={() => {
                  const targetLabel = kpTarget && kpTarget !== lead?.email ? `на ${kpTarget}` : ''
                  if (!comment) setComment(`Отправлено КП на Email ${targetLabel}`.trim())
                }}
                className="call-pill call-pill--blue"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px' }}
                title="Открыть почтовый клиент с заполненным письмом предложения"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Создать письмо с КП
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(getProposalText(lead))
                setCopiedKp(true)
                setTimeout(() => setCopiedKp(false), 2000)
              }}
              className="call-pill"
              style={{ padding: '7px 12px' }}
            >
              {copiedKp ? 'Скопировано!' : 'Скопировать текст'}
            </button>
          </div>

          <div style={{
            padding: '9px 11px',
            borderRadius: 10,
            background: 'rgba(var(--ink-rgb), 0.035)',
            fontSize: 12,
            lineHeight: 1.45,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            maxHeight: 100,
            overflowY: 'auto',
            border: '1px solid rgba(var(--ink-rgb), 0.06)'
          }}>
            {getProposalText(lead)}
          </div>
        </div>
      )}

      {outcome && outcome !== 'no_answer' && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Комментарий после звонка{cfg?.needsComment ? ' *' : ''}</span>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); setError('') }}
            placeholder={cfg?.needsComment ? 'О чём говорили, что решили…' : 'Необязательно: когда удобно, что сказали…'}
            autoFocus
            style={{ width: '100%', minHeight: 70, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(var(--ink-rgb), 0.12)', background: 'var(--fill)', fontSize: 13, fontFamily: 'var(--font-sys)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {showDateBlock && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Когда перезвонить</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {DATE_PRESETS.map(p => (
              <button key={p.days} onClick={() => setPreset(p.days)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                {p.label}
              </button>
            ))}
          </div>
          <DateInput
            type="datetime-local"
            value={nextCall}
            onChange={e => setNextCall(e.target.value)}
            className="form-input"
            style={{ width: '100%', background: 'var(--fill)' }}
          />
          {!nextCall && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Если не указать дату — бэкенд поставит её сам по каденции.
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--fg-e0473b)', marginBottom: 12 }}>{error}</div>}

      <button onClick={handleSave} disabled={saving || !outcome} className={`call-save${outcome ? ' is-ready' : ''}`}>
        <SwapText>{saving ? 'Сохраняю…' : outcome ? 'Сохранить' : 'Выберите результат звонка'}</SwapText>
        {outcome && !saving && <kbd className="call-key call-key--on">↵</kbd>}
      </button>
    </div>
  )
}
