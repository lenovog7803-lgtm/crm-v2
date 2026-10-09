import CallCard from './CallCard'
import ScriptPanel from './ScriptPanel'
import CallOutcomeBar from './CallOutcomeBar'
import { useIsMobile } from '../../hooks/useIsMobile'

// Окно звонка в стиле macOS / Spotlight: стеклянная панель над размытой CRM,
// внутри — сгруппированные «листы» без тяжёлых рамок. Логика — в CallCard/CallOutcomeBar.
export default function CallWindow({ lead, onClose, onClaim, onEdit, onSave, saving }) {
  const isMobile = useIsMobile()
  return (
    <div className="call-window-scrim" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', overflowY: 'auto',
      padding: isMobile ? 10 : 24, background: 'rgba(14,23,38,0.22)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'pageIn 0.18s ease-out' }}>
      <div className="leads-call-modal call-window" style={{ width: '100%', maxWidth: 1040, margin: 'auto', borderRadius: 28, overflow: 'hidden' }}>
        {/* панель окна: заголовок слева, действия справа — как тулбар macOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isMobile ? '12px 14px' : '14px 18px 4px 22px' }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#8A93A0', letterSpacing: '-0.01em' }}>Звонок</div>
          {!lead.assigned_to && onClaim && (
            <button onClick={e => onClaim(lead.id, e)} className="call-pill call-pill--blue">Взять в работу</button>
          )}
          <button onClick={onClose} aria-label="Закрыть" title="Закрыть" className="call-close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: isMobile ? '4px 10px 12px' : '6px 18px 18px' }}>
          {/* 1 — кто это: шапка во всю ширину */}
          <CallCard lead={lead} onEdit={onEdit} part="header" />
          {/* 2 — во время разговора: скрипт слева, результат справа — на одном уровне глаз */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.15fr 1fr', gap: 14, alignItems: 'start' }}>
            <ScriptPanel stage={lead?.stage} />
            <CallOutcomeBar lead={lead} onSave={onSave} saving={saving} columns={2} />
          </div>
          {/* 3 — справка: описание компании и история звонков */}
          <CallCard lead={lead} onEdit={onEdit} part="history" />
        </div>
      </div>
    </div>
  )
}
