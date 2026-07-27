import { useState, useEffect } from 'react'
import { getCallHistory } from '../../api'
import { stageById, outcomeById } from '../../constants/leads'

const chip = (bg, color) => ({ padding: '4px 11px', borderRadius: 8, background: bg, color, fontSize: 11.5, fontWeight: 600 })

export default function CallCard({ lead, onEdit }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (!lead?.id) return
    getCallHistory(lead.id).then(r => setHistory(r.calls || [])).catch(() => setHistory([]))
  }, [lead?.id])

  if (!lead) return null

  const stage = stageById(lead.stage)
  const attempts = lead.call_attempts || 0
  const cadenceStep = lead.cadence_step || 0

  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 22, color: '#0E1726' }}>{lead.name}</div>
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: 17, color: '#1366F0', marginTop: 6 }}>{lead.phone || '—'}</div>
        </div>
        <button onClick={() => onEdit(lead)} className="btn-ghost" style={{ flexShrink: 0 }}>
          Редактировать данные
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

      {lead.notes && (
        <div style={{ fontSize: 13, color: '#5A6573', lineHeight: 1.5, background: 'rgba(14,23,38,0.03)', borderRadius: 12, padding: '10px 13px' }}>
          {lead.notes}
        </div>
      )}

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          История звонков {history.length > 0 && `(${history.length})`}
        </div>
        {history.length === 0 && <div style={{ fontSize: 12.5, color: '#A6AEB8' }}>Звонков ещё не было</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {history.map((h) => {
            const o = outcomeById(h.outcome)
            return (
              <div key={h.id} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(14,23,38,0.03)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, flexShrink: 0 }}>{o?.icon || '📞'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: o?.color || '#8A93A0', fontWeight: 700 }}>
                    {o?.label || h.outcome} · {new Date(h.created_at).toLocaleString('ru-RU')}
                  </div>
                  {h.comment && <div style={{ fontSize: 12.5, color: '#5A6573', marginTop: 2 }}>{h.comment}</div>}
                  {h.lost_reason && <div style={{ fontSize: 12, color: '#E0473B', marginTop: 2 }}>Причина: {h.lost_reason}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
