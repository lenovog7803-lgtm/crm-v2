import { useState, useEffect } from 'react'
import { getCallHistory } from '../../api'
import { stageById, outcomeById } from '../../constants/leads'
import { initials, getGradient } from '../../utils'
import { OutcomeIcon } from './OutcomeIcon'

function NoteIcon(p) {
  return (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}

const chip = (bg, color) => ({ padding: '4px 11px', borderRadius: 99, background: bg, color, fontSize: 12, fontWeight: 600 })

// part: 'header' — шапка (без истории), 'history' — описание и история, по умолчанию — всё
export default function CallCard({ lead, onEdit, part }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!lead?.id || part === 'header') return
    getCallHistory(lead.id).then(r => setHistory(r.calls || [])).catch(() => setHistory([]))
  }, [lead?.id])

  if (!lead) return null

  const stage = stageById(lead.stage)
  const attempts = lead.call_attempts || 0
  const cadenceStep = lead.cadence_step || 0
  const [avA, avB] = getGradient(lead.name || '')

  const legacyNotes = (lead.call_notes || []).map((n, i) => ({
    id: `legacy-${i}-${n.date}`,
    kind: 'note',
    text: n.text,
    author: n.author,
    created_at: n.date,
  }))
  const callEntries = history.map(h => ({ ...h, kind: 'call' }))
  const timeline = [...callEntries, ...legacyNotes].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  const headerEl = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 15, flexShrink: 0,
            background: `linear-gradient(160deg, ${avA} 0%, ${avB} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 19, letterSpacing: '-0.02em',
            boxShadow: `0 6px 16px -6px ${avB}90, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}>{initials(lead.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 21, letterSpacing: '-0.02em', color: '#0E1726', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
            {lead.phone ? (
              <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="call-pill call-pill--green" style={{ marginTop: 6 }} title="Позвонить">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{lead.phone}</span>
              </a>
            ) : <div style={{ fontSize: 13, color: '#A6AEB8', marginTop: 4 }}>нет телефона</div>}
          </div>
        </div>
        <button onClick={() => onEdit(lead)} className="call-pill" style={{ flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          Изменить
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip(stage.bg, stage.color)}>{stage.label}</span>
        {cadenceStep > 0 && <span style={chip('rgba(14,23,38,0.06)', '#5A6573')}>шаг каденции {cadenceStep} из 5</span>}
        {lead.industry && <span style={chip('rgba(244,122,31,0.1)', '#F47A1F')}>{lead.industry}</span>}
        {lead.city && <span style={chip('rgba(14,23,38,0.06)', '#5A6573')}>{lead.city}</span>}
        {lead.region && <span style={chip('rgba(14,23,38,0.06)', '#5A6573')}>{lead.region}</span>}
        {attempts > 0 && <span style={chip('rgba(217,119,6,0.12)', '#D97706')}>попыток дозвона: {attempts}</span>}
      </div>

      {attempts >= 3 && (
        <div style={{ background: 'rgba(224,71,59,0.08)', border: '1px solid rgba(224,71,59,0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: '#E0473B' }}>
          {attempts} неудачных дозвона подряд. После 5-й лид уйдёт в «Нет контакта».
        </div>
      )}

      {(lead.contact_person || lead.contact_position) && (
        <div style={{ fontSize: 13, color: '#5A6573' }}>
          {[lead.contact_person, lead.contact_position].filter(Boolean).join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5 }}>
        {lead.website && (
          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: '#1366F0', fontWeight: 600 }}>
            {lead.website}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{ color: '#1366F0', fontWeight: 600 }}>{lead.email}</a>
        )}
      </div>

    </>
  )
  const historyEl = (
    <>      {lead.notes && (
        <div style={{ fontSize: 13.5, color: '#3A4454', lineHeight: 1.55, background: 'rgba(14,23,38,0.035)', borderRadius: 14, padding: '12px 14px' }}>
          {lead.notes}
        </div>
      )}

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0E1726', marginBottom: 10, letterSpacing: '-0.01em' }}>
          История звонков {timeline.length > 0 && <span style={{ color: '#A6AEB8', fontWeight: 600 }}>{timeline.length}</span>}
        </div>
        {timeline.length === 0 && <div style={{ fontSize: 12.5, color: '#A6AEB8' }}>Звонков ещё не было</div>}
        <div className="call-timeline" style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto' }}>
          {timeline.map((h) => {
            if (h.kind === 'note') {
              return (
                <div key={h.id} className="call-tl-row">
                  <div style={{
                    width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(138,147,160,0.15)', color: '#8A93A0',
                  }}><NoteIcon width={12} height={12} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: '#8A93A0', fontWeight: 700 }}>
                      {h.author ? `${h.author} · ` : ''}{h.created_at ? new Date(h.created_at).toLocaleString('ru-RU') : ''}
                    </div>
                    {h.text && <div style={{ fontSize: 13.5, color: '#3A4454', marginTop: 2 }}>{h.text}</div>}
                  </div>
                </div>
              )
            }
            const o = outcomeById(h.outcome)
            return (
              <div key={h.id} className="call-tl-row">
                <div style={{
                  width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (o?.color || '#8A93A0') + '1A', color: o?.color || '#8A93A0',
                }}><OutcomeIcon id={o?.id || 'reached'} size={12} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: o?.color || '#8A93A0', fontWeight: 700 }}>
                    {o?.label || h.outcome} · {new Date(h.created_at).toLocaleString('ru-RU')}
                  </div>
                  {h.comment && <div style={{ fontSize: 13.5, color: '#3A4454', marginTop: 2 }}>{h.comment}</div>}
                  {h.lost_reason && <div style={{ fontSize: 12, color: '#E0473B', marginTop: 2 }}>Причина: {h.lost_reason}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
  return (
    <div className="card call-sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {part !== 'history' && headerEl}
      {part !== 'header' && historyEl}
    </div>
  )
}
