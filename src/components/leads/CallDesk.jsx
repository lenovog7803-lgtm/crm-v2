import CallCard from './CallCard'
import CallOutcomeBar from './CallOutcomeBar'
import { LeadQualification } from './GrowthWidgets'

export default function CallDesk({ lead, onEdit, onClaim, onSave, saving }) {
  return (
    <div className="detail-grid lead-desk">
      <div className="lead-desk-company">
        <div className="lead-desk-contact">
          <CallCard lead={lead} onEdit={onEdit} onClaim={onClaim} part="header">
            <LeadQualification lead={lead} />
            <CallCard lead={lead} part="history" />
          </CallCard>
        </div>
      </div>
      <aside className="lead-desk-outcome" aria-label="Результат звонка">
        <CallOutcomeBar lead={lead} onSave={onSave} saving={saving} />
      </aside>
    </div>
  )
}
