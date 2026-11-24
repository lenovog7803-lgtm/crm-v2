import { useState, useEffect } from 'react'
import { getCallHistory, claimLead } from '../../api'
import { stageById, outcomeById } from '../../constants/leads'
import { useAuth } from '../../AuthContext'
import { OutcomeIcon } from './OutcomeIcon'

function NoteIcon(p) {
  return (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

// part: 'header' — шапка (без истории), 'history' — описание и история, по умолчанию — всё
export default function CallCard({ lead, onEdit, onClaim, part }) {
  const { user } = useAuth()
  const myId = user?.user?.id
  const [history, setHistory] = useState([])
  const [assigned, setAssigned] = useState(lead?.assigned_to || '')

  useEffect(() => {
    setAssigned(lead?.assigned_to || '')
  }, [lead?.assigned_to])

  const handleClaimLead = async () => {
    if (!lead?.id) return
    const claimId = myId || '553e8660-5728-439c-8532-7bb1b2d4ae67'
    if (onClaim) {
      await onClaim(lead.id)
      return
    }
    try {
      await claimLead(lead.id)
      setAssigned(claimId)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!lead?.id || part === 'header') return
    getCallHistory(lead.id).then(r => setHistory(r.calls || [])).catch(() => setHistory([]))
  }, [lead?.id, part])

  if (!lead) return null

  const stage = stageById(lead.stage)
  const attempts = lead.call_attempts || 0
  const digits = (lead.phone || '').replace(/[^\d+]/g, '')

  const legacyNotes = (lead.call_notes || []).map((n, i) => ({
    id: `legacy-${i}-${n.date}`,
    kind: 'note',
    text: n.text,
    author: n.author,
    created_at: n.date,
  }))
  const callEntries = history.map(h => ({ ...h, kind: 'call' }))
  const timeline = [...callEntries, ...legacyNotes].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const contact = [lead.contact_person, lead.contact_position].filter(Boolean).join(' · ')
  const legacyReasonPattern = /^[ 	]*(?:💡[ 	]*)?Почему взят:[ 	]*([^\r\n]+)$/mu
  const legacyReason = lead.notes?.match(legacyReasonPattern)?.[1]?.trim()
  const selectionReason = lead.selection_reason?.trim() || legacyReason
  const headerEl = (
    <div className="card lead-contact-card">
      <div className="lead-contact-header">
        <div>
          <h2 className="lead-company-title" title={lead.name}>{lead.name?.replace(/^Индивидуальный предприниматель\s+/i, 'ИП ')}</h2>
          <div className="lead-contact-meta">{[stage.label, contact, lead.city].filter(Boolean).join(' · ')}</div>
        </div>
        <button type="button" onClick={() => onEdit(lead)} className="btn-ghost">Изменить</button>
      </div>
      <div className="lead-contact-actions">
        {digits
          ? <a href={`tel:${digits}`} className="btn-primary lead-phone-action">Позвонить · {lead.phone}</a>
          : <span className="lead-assignment">Телефон не указан</span>}
        {assigned
          ? <span className="lead-assignment">{assigned === myId ? 'В вашей работе' : 'В работе'}</span>
          : <button type="button" onClick={handleClaimLead} className="btn-ghost">Взять в работу</button>}
      </div>
      {selectionReason && (
        <details className="lead-selection-reason">
          <summary>
            Почему взят клиент
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </summary>
          <p>{selectionReason}</p>
        </details>
      )}
      {attempts >= 3 && <div className="lead-contact-warning">
        Неудачных попыток дозвона: {attempts}. После пятой лид перейдёт в «Отказ».
      </div>}
    </div>
  )
  const historyNotes = legacyReason && legacyReason === selectionReason
    ? lead.notes.replace(legacyReasonPattern, '')
    : lead.notes
  const notes = historyNotes?.replace(/^\s*(?:🎯\s*)?Скрипт:[^\n]*$/gmu, '').replace(/[💡🎯🔥⚡🌐📦🏭👤✓]/gu, '').trim()
  const historyEl = (
    <>
      {notes && (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginBottom: 14 }}>
          {notes}
        </div>
      )}

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 10, letterSpacing: '-0.01em' }}>
          История звонков {timeline.length > 0 && <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>{timeline.length}</span>}
        </div>
        {timeline.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Звонков ещё не было</div>}
        <div className="call-timeline" style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto' }}>
          {timeline.map((h) => {
            if (h.kind === 'note') {
              return (
                <div key={h.id} className="call-tl-row">
                  <div style={{
                    width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(138,147,160,0.15)', color: 'var(--text-3)',
                  }}><NoteIcon width={12} height={12} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>
                      {h.author ? `${h.author} · ` : ''}{h.created_at ? new Date(h.created_at).toLocaleString('ru-RU') : ''}
                    </div>
                    {h.text && <div style={{ fontSize: 14, color: 'var(--text-strong)', marginTop: 2 }}>{h.text}</div>}
                  </div>
                </div>
              )
            }
            const o = outcomeById(h.outcome)
            return (
              <div key={h.id} className="call-tl-row">
                <div style={{
                  width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `color-mix(in srgb, ${(o?.color || 'var(--text-3)')} 10%, transparent)`, color: o?.color || 'var(--text-3)',
                }}><OutcomeIcon id={o?.id || 'reached'} size={12} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: o?.color || 'var(--text-3)', fontWeight: 700 }}>
                    {o?.label || h.outcome} · {new Date(h.created_at).toLocaleString('ru-RU')}
                  </div>
                  {h.comment && <div style={{ fontSize: 14, color: 'var(--text-strong)', marginTop: 2 }}>{h.comment}</div>}
                  {h.lost_reason && <div style={{ fontSize: 12, color: 'var(--fg-e0473b)', marginTop: 2 }}>Причина: {h.lost_reason}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
  return part === 'history' ? historyEl : headerEl
}
