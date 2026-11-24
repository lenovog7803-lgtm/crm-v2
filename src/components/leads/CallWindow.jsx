import ModalScrim from '../ModalScrim'
import GlassDialog from '../GlassDialog'
import CallDesk from './CallDesk'

// Окно звонка в стиле macOS / Spotlight: стеклянная панель над размытой CRM,
// внутри — сгруппированные «листы» без тяжёлых рамок. Логика — в CallCard/CallOutcomeBar.
export default function CallWindow({ lead, onClose, onClaim, onEdit, onSave, saving }) {
  return (
    <ModalScrim className="dash-modal-scrim lead-call-scrim">
      <GlassDialog label="Звонок" onDismiss={onClose} className="dash-modal leads-call-modal">
        <div className="lead-call-dialog-header">
          <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '-0.01em' }}>Звонок</div>
          <button data-dialog-dismiss onClick={onClose} aria-label="Закрыть" title="Закрыть" className="btn-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <CallDesk key={lead.id} {...{ lead, onEdit, onClaim, onSave, saving }} />
      </GlassDialog>
    </ModalScrim>
  )
}
