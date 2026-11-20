import { useState, useEffect } from 'react'
import {
  getProposalText,
  cleanPhoneIntl,
  getWhatsAppKpUrl,
  getTelegramCustomUrl,
  getEmailKpUrl,
} from './commercialProposal'

export default function SendProposalModal({ lead, onClose, onSave }) {
  const [channel, setChannel] = useState('whatsapp')
  const [target, setTarget] = useState(lead?.phone || '')
  const [proposalText, setProposalText] = useState('')
  const [copied, setCopied] = useState(false)
  const [markOutcome, setMarkOutcome] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setProposalText(getProposalText(lead))
  }, [lead])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSelectChannel = (ch) => {
    setChannel(ch)
    if (ch === 'email') {
      setTarget(lead?.email || '')
    } else if (ch === 'telegram') {
      setTarget(lead?.telegram || lead?.phone || '')
    } else {
      setTarget(lead?.phone || '')
    }
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(proposalText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSend = async () => {
    if (sending) return
    setSending(true)

    const chName = channel === 'whatsapp' ? 'WhatsApp' : channel === 'telegram' ? 'Telegram' : 'Email'
    const finalTarget = target.trim()

    // 1. Открытие соответствующего канала
    if (channel === 'whatsapp') {
      const url = getWhatsAppKpUrl(finalTarget || lead?.phone, proposalText)
      if (url) window.open(url, '_blank')
    } else if (channel === 'telegram') {
      navigator.clipboard?.writeText(proposalText)
      const url = getTelegramCustomUrl(finalTarget || lead?.phone)
      if (url) window.open(url, '_blank')
    } else if (channel === 'email') {
      const mailUrl = getEmailKpUrl(finalTarget || lead?.email, lead, proposalText)
      if (mailUrl) window.location.href = mailUrl
    }

    // 2. Если включена фиксация результата — сохраняем результат звонка в CRM
    if (markOutcome && onSave) {
      const targetNote = finalTarget && finalTarget !== lead?.phone && finalTarget !== lead?.email
        ? ` на ${finalTarget}`
        : ''
      await onSave({
        outcome: 'quote',
        comment: `Отправлено КП в ${chName}${targetNote}`,
      })
    }

    setSending(false)
    onClose()
  }

  const companyName = lead?.company || lead?.name || 'Клиент'
  const isWb =
    lead?.funnel === 'WB_OZON' ||
    (lead?.industry && lead.industry.includes('WB')) ||
    (lead?.niche && lead.niche.includes('WB'))

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: 16,
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--panel)',
          borderRadius: 22,
          padding: 24,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.32), 0 0 0 1px rgba(var(--ink-rgb), 0.12)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: 14,
            border: 'none',
            background: 'rgba(var(--ink-rgb), 0.06)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Заголовок */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Отправить коммерческое предложение
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{companyName}</span>
            <span>·</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
              background: 'rgba(var(--rgb-19-102-240), 0.1)', color: 'var(--fg-1366f0)'
            }}>
              {isWb ? 'WB / Ozon' : 'B2B РФ'}
            </span>
          </div>
        </div>

        {/* Выбор канала отправки */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Канал отправки:
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => handleSelectChannel('whatsapp')}
              className="call-pill"
              style={{
                flex: 1, height: 40, justifyContent: 'center',
                background: channel === 'whatsapp' ? 'rgba(var(--rgb-19-102-240), 0.18)' : 'rgba(var(--ink-rgb), 0.04)',
                boxShadow: channel === 'whatsapp' ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.5)' : 'none',
                color: channel === 'whatsapp' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: channel === 'whatsapp' ? 600 : 400,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
              WhatsApp
            </button>

            <button
              type="button"
              onClick={() => handleSelectChannel('telegram')}
              className="call-pill"
              style={{
                flex: 1, height: 40, justifyContent: 'center',
                background: channel === 'telegram' ? 'rgba(var(--rgb-19-102-240), 0.18)' : 'rgba(var(--ink-rgb), 0.04)',
                boxShadow: channel === 'telegram' ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.5)' : 'none',
                color: channel === 'telegram' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: channel === 'telegram' ? 600 : 400,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.121l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.832.942z"/>
              </svg>
              Telegram
            </button>

            <button
              type="button"
              onClick={() => handleSelectChannel('email')}
              className="call-pill"
              style={{
                flex: 1, height: 40, justifyContent: 'center',
                background: channel === 'email' ? 'rgba(var(--rgb-19-102-240), 0.18)' : 'rgba(var(--ink-rgb), 0.04)',
                boxShadow: channel === 'email' ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.5)' : 'none',
                color: channel === 'email' ? 'var(--fg-1366f0)' : 'var(--text-secondary)',
                fontWeight: channel === 'email' ? 600 : 400,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Почта (Email)
            </button>
          </div>
        </div>

        {/* Адресат (номер / ник / email) */}
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {channel === 'whatsapp'
              ? 'Номер телефона для WhatsApp:'
              : channel === 'telegram'
              ? 'Номер или никнейм в Telegram (@логин):'
              : 'Адрес электронной почты (Email):'}
          </label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={
              channel === 'whatsapp'
                ? '+375... (можно изменить, если дали другой номер)'
                : channel === 'telegram'
                ? '+375... или @username'
                : 'email@company.by'
            }
            className="form-input"
            style={{
              width: '100%',
              height: 40,
              padding: '0 12px',
              fontSize: 14,
              fontFamily: 'var(--font-sys)',
              background: 'var(--fill)',
              borderRadius: 12,
              border: '1px solid rgba(var(--ink-rgb), 0.14)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Текст предложения */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Текст предложения:
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-ghost"
              style={{ fontSize: 11, padding: '3px 8px' }}
            >
              {copied ? 'Скопировано!' : 'Скопировать'}
            </button>
          </div>
          <textarea
            value={proposalText}
            onChange={(e) => setProposalText(e.target.value)}
            style={{
              width: '100%',
              minHeight: 130,
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid rgba(var(--ink-rgb), 0.12)',
              background: 'var(--fill)',
              fontSize: 12,
              lineHeight: 1.45,
              fontFamily: 'var(--font-sys)',
              color: 'var(--ink)',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Чекбокс автоматической фиксации результата */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
          <input
            type="checkbox"
            checked={markOutcome}
            onChange={(e) => setMarkOutcome(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--fg-1366f0)' }}
          />
          <span>Зафиксировать в CRM результат звонка как <b>«Отправил КП»</b></span>
        </label>

        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            style={{ height: 42, padding: '0 18px', borderRadius: 12 }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="call-save is-ready"
            style={{ height: 42, padding: '0 20px', borderRadius: 12, minWidth: 160 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>{channel === 'whatsapp' ? 'Открыть WhatsApp' : channel === 'telegram' ? 'Открыть Telegram' : 'Создать письмо'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
