import { useState, useEffect } from 'react'
import { OUTCOMES, LOST_REASONS, DATE_PRESETS } from '../../constants/leads'
import { OutcomeIcon } from './OutcomeIcon'
import { SwapText } from '../Transitions'
import Select from '../Select'
import DateInput from '../DateInput'

const labelStyle = { fontSize: 15, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 12, display: 'block' }

export default function CallOutcomeBar({ lead, onSave, saving, columns = 3 }) {
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
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 44, borderRadius: 12,
              background: outcome === o.id ? 'rgba(var(--rgb-19-102-240), 0.1)' : 'rgba(var(--ink-rgb), 0.035)',
              boxShadow: outcome === o.id ? 'inset 0 0 0 1.5px rgba(var(--rgb-19-102-240), 0.45)' : 'none',
              border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: outcome === o.id ? 'var(--fg-1366f0)' : 'var(--text-3)', transition: 'color 0.15s var(--ease)',
            }}><OutcomeIcon id={o.id} size={17} /></span>
            <span style={{ fontFamily: 'var(--font-sys)', fontSize: 14, fontWeight: outcome === o.id ? 600 : 400, color: outcome === o.id ? 'var(--fg-1366f0)' : 'var(--ink)' }}>
              {o.label}
            </span>
          </button>
        ))}
      </div>

      {cfg?.needsReason && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Причина отказа</span>
          <Select value={lostReason} onChange={e => { setLostReason(e.target.value); setError('') }} className="form-input" style={{ width: '100%', background: 'var(--fill)' }}>
            <option value="">Выберите причину…</option>
            {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </div>
      )}

      {outcome && outcome !== 'no_answer' && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Комментарий после звонка{cfg?.needsComment ? ' *' : ''}</span>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); setError('') }}
            placeholder={cfg?.needsComment ? 'О чём говорили, что решили…' : 'Необязательно: когда удобно, что сказали…'}
            autoFocus
            style={{ width: '100%', minHeight: 70, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(var(--ink-rgb), 0.12)', background: 'var(--fill)', fontSize: 13, fontFamily: 'var(--font-sys)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }}
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
            style={{ width: '100%', background: 'var(--fill)' }}
          />
          {!nextCall && (
            <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 6 }}>
              Если не указать дату — бэкенд поставит её сам по каденции.
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: 'var(--fg-e0473b)', marginBottom: 12 }}>{error}</div>}

      <button onClick={handleSave} disabled={saving || !outcome} className={`call-save${outcome ? ' is-ready' : ''}`}>
        <SwapText>{saving ? 'Сохраняю…' : outcome ? 'Сохранить и следующий' : 'Выберите результат звонка'}</SwapText>
      </button>
    </div>
  )
}
