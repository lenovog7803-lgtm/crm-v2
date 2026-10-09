import { useState, useEffect } from 'react'
import { OUTCOMES, LOST_REASONS, DATE_PRESETS } from '../../constants/leads'
import { OutcomeIcon } from './OutcomeIcon'
import { SwapText } from '../Transitions'
import Select from '../Select'
import DateInput from '../DateInput'

const labelStyle = { fontSize: 13, fontWeight: 700, color: '#0E1726', letterSpacing: '-0.01em', marginBottom: 10, display: 'block' }

export default function CallOutcomeBar({ lead, onSave, saving, columns = 4 }) {
  const [outcome, setOutcome] = useState(null)
  const [comment, setComment] = useState('')
  const [lostReason, setLostReason] = useState('')
  const [nextCall, setNextCall] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setOutcome(null)
    setComment('')
    setLostReason('')
    setNextCall('')
    setError('')
  }, [lead?.id])

  const cfg = OUTCOMES.find(o => o.id === outcome) || null
  const showDateBlock = outcome && outcome !== 'no_answer' && outcome !== 'won' && outcome !== 'lost'

  const setPreset = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(10, 0, 0, 0)
    setNextCall(d.toISOString().slice(0, 16))
  }

  const handleSave = () => {
    if (!outcome || !cfg) { setError('Выберите результат звонка'); return }
    if (cfg?.needsComment && !comment.trim()) { setError('Напишите комментарий'); return }
    if (cfg?.needsReason && !lostReason) { setError('Укажите причину отказа'); return }

    setError('')
    onSave({
      outcome,
      comment: comment.trim(),
      lost_reason: cfg?.needsReason ? lostReason : undefined,
      next_call: nextCall ? new Date(nextCall).toISOString() : undefined,
    })
  }

  return (
    <div className="card call-sheet" style={{ padding: 20 }}>
      <span style={labelStyle}>Результат звонка</span>
      <div className="call-outcomes" style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8, marginBottom: 16 }}>
        {OUTCOMES.map(o => (
          <button
            key={o.id}
            onClick={() => { setOutcome(o.id); setError('') }}
            className="call-outcome"
            aria-pressed={outcome === o.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14,
              background: outcome === o.id ? o.color + '1F' : 'rgba(255,255,255,0.75)',
              boxShadow: outcome === o.id ? `inset 0 0 0 1.5px ${o.color}66` : 'inset 0 0 0 1px rgba(14,23,38,0.07), 0 1px 2px rgba(14,23,38,0.04)',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: outcome === o.id ? o.color : o.color + '1A',
              color: outcome === o.id ? '#fff' : o.color,
              transition: 'all 0.15s var(--ease)',
            }}><OutcomeIcon id={o.id} size={14} /></span>
            <span style={{ fontFamily: 'var(--font-sys)', fontSize: 13.5, fontWeight: outcome === o.id ? 700 : 500, color: outcome === o.id ? o.color : '#0E1726' }}>
              {o.label}
            </span>
          </button>
        ))}
      </div>

      {cfg?.needsReason && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Причина отказа</span>
          <Select value={lostReason} onChange={e => { setLostReason(e.target.value); setError('') }} className="form-input" style={{ width: '100%', background: '#F7F8FA' }}>
            <option value="">Выберите причину…</option>
            {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      )}

      {outcome && outcome !== 'no_answer' && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Комментарий после звонка *</span>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); setError('') }}
            placeholder="О чём говорили, что решили…"
            autoFocus
            style={{ width: '100%', minHeight: 70, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: '#F7F8FA', fontSize: 13, fontFamily: 'var(--font-sys)', color: '#0E1726', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {showDateBlock && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Когда перезвонить</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {DATE_PRESETS.map(p => (
              <button key={p.days} onClick={() => setPreset(p.days)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: 11.5 }}>
                {p.label}
              </button>
            ))}
          </div>
          <DateInput
            type="datetime-local"
            value={nextCall}
            onChange={e => setNextCall(e.target.value)}
            className="form-input"
            style={{ width: '100%', background: '#F7F8FA' }}
          />
          {!nextCall && (
            <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 6 }}>
              Если не указать дату — бэкенд поставит её сам по каденции.
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#E0473B', marginBottom: 12 }}>{error}</div>}

      <button onClick={handleSave} disabled={saving || !outcome} className={`call-save${outcome ? ' is-ready' : ''}`}>
        <SwapText>{saving ? 'Сохраняю…' : outcome ? 'Сохранить и следующий' : 'Выберите результат звонка'}</SwapText>
      </button>
    </div>
  )
}
