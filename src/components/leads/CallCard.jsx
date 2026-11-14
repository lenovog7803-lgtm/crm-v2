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

// part: 'header' — шапка (без истории), 'history' — описание и история, по умолчанию — всё
export default function CallCard({ lead, onEdit, part }) {
  const [history, setHistory] = useState([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!lead?.id || part === 'header') return
    getCallHistory(lead.id).then(r => setHistory(r.calls || [])).catch(() => setHistory([]))
  }, [lead?.id])

  if (!lead) return null

  const stage = stageById(lead.stage)
  const attempts = lead.call_attempts || 0
  const cadenceStep = lead.cadence_step || 0
  const [avA, avB] = getGradient(lead.name || '')
  const digits = (lead.phone || '').replace(/[^\d+]/g, '')
  const intl = digits.replace(/\D/g, '').replace(/^80(?=\d{9}$)/, '375')   // 8 0ХХ … → 375 ХХ … для мессенджеров
  const copyPhone = () => navigator.clipboard?.writeText(lead.phone).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})

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
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            '--av-hue': avB, background: `linear-gradient(160deg, ${avA} 0%, ${avB} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em',
            boxShadow: `0 6px 16px -6px color-mix(in srgb, ${avB} 56%, transparent), inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}>{initials(lead.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 600, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
            {lead.phone ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <a href={`tel:${digits}`} className="call-pill call-pill--tel" title="Позвонить">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{lead.phone}</span>
                </a>
                <button onClick={copyPhone} className="call-pill" title="Скопировать номер">{copied ? 'Скопировано' : 'Копировать'}</button>
                <a href={`viber://chat?number=%2B${intl}`} className="call-pill" title="Написать в Viber">Viber</a>
                <a href={`https://t.me/+${intl}`} target="_blank" rel="noreferrer" className="call-pill" title="Написать в Telegram">Telegram</a>
                <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className="call-pill" title="Написать в WhatsApp">WhatsApp</a>
              </div>
            ) : <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>нет телефона</div>}
          </div>
        </div>
        <button onClick={() => onEdit(lead)} className="call-pill" style={{ flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          Изменить
        </button>
      </div>

      <div className="lead-meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 500 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: stage.color }} />{stage.label}
        </span>
        {[cadenceStep > 0 && `шаг каденции ${cadenceStep} из 5`, lead.industry, lead.city, lead.region, attempts > 0 && `попыток дозвона: ${attempts}`]
          .filter(Boolean).map(t => <span key={t}>{t}</span>)}
      </div>

      {attempts >= 3 && (
        <div style={{ background: 'rgba(var(--rgb-224-71-59), 0.08)', border: '1px solid rgba(var(--rgb-224-71-59), 0.2)', borderRadius: 12, padding: '10px 14px', fontSize: 12, color: 'var(--fg-e0473b)' }}>
          {attempts} неудачных дозвона подряд. После 5-го лид уйдёт в «Отказ» с причиной «Не дозвонились».
        </div>
      )}

      {(lead.contact_person || lead.contact_position) && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {[lead.contact_person, lead.contact_position].filter(Boolean).join(' · ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
        {lead.website && (
          <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" style={{ color: 'var(--fg-1366f0)', textDecoration: 'none' }}>
            {lead.website}
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} style={{ color: 'var(--fg-1366f0)', textDecoration: 'none' }}>{lead.email}</a>
        )}
      </div>

    </>
  )
  const historyEl = (
    <>      {lead.notes && (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
          {lead.notes}
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
  return (
    <div className="card call-sheet" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {part !== 'history' && headerEl}
      {part !== 'header' && historyEl}
    </div>
  )
}
