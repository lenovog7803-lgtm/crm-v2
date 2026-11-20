import { useEffect } from 'react'
import { cleanPhoneIntl, getQrCodeUrl } from './commercialProposal'

export default function QuickCallQrModal({ lead, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!lead?.phone) return null

  const intl = cleanPhoneIntl(lead.phone)
  const qrUrl = getQrCodeUrl(lead.phone)
  const companyName = lead.company || lead.name || 'Клиент'

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
        background: 'rgba(0, 0, 0, 0.45)',
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
          maxWidth: 340,
          background: 'var(--panel)',
          borderRadius: 22,
          padding: 24,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(var(--ink-rgb), 0.12)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
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

        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4 }}>
          Звонок с телефона
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {companyName}
        </div>

        {/* Белая подложка под QR-код для контраста камеры в тёмной теме */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            borderRadius: 18,
            padding: 12,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
            marginBottom: 16,
          }}
        >
          <img
            src={qrUrl}
            alt={`QR звонка на ${lead.phone}`}
            width={180}
            height={180}
            style={{ display: 'block', borderRadius: 8 }}
          />
        </div>

        <div style={{ fontFamily: 'var(--font-sys)', fontVariantNumeric: 'tabular-nums', fontSize: 18, fontWeight: 700, color: 'var(--fg-1366f0)', marginBottom: 8 }}>
          +{intl}
        </div>

        <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--text-tertiary)', marginBottom: 16 }}>
          Наведите камеру смартфона — появится кнопка «Вызов» для звонка без сохранения номера в контакты.
        </div>

        <a
          href={`tel:+${intl}`}
          className="call-pill call-pill--blue"
          style={{ width: '100%', justifyContent: 'center', height: 38, textDecoration: 'none', fontSize: 13 }}
        >
          Позвонить прямо с этого устройства
        </a>
      </div>
    </div>
  )
}
