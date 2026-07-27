import { useState, useEffect } from 'react'
import { OUTCOMES, LOST_REASONS, DATE_PRESETS } from '../../constants/leads'

const labelStyle = { fontSize: 10, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }

export default function CallOutcomeBar({ lead, onSave, saving }) {
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

  const cfg = OUTCOMES.find(o => o.id === outcome)
  const showDateBlock = outcome && outcome !== 'no_answer' && outcome !== 'won' && outcome !== 'lost'

  const setPreset = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(10, 0, 0, 0)
    setNextCall(d.toISOString().slice(0, 16))
  }

  const handleSave = () => {
    if (!outcome) { setError('Выберите результат звонка'); return }
    if (cfg.needsComment && !comment.trim()) { setError('Напишите комментарий'); return }
    if (cfg.needsReason && !lostReason) { setError('Укажите причину отказа'); return }

    setError('')
    onSave({
      outcome,
      comment: comment.trim(),
      lost_reason: cfg.needsReason ? lostReason : undefined,
      next_call: nextCall ? new Date(nextCall).toISOString() : undefined,
    })
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <span style={labelStyle}>Результат звонка</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        {OUTCOMES.map(o => (
          <button
            key={o.id}
            onClick={() => { setOutcome(o.id); setError('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12,
              background: outcome === o.id ? o.color + '1F' : 'rgba(255,255,255,0.6)',
              border: `1.5px solid ${outcome === o.id ? o.color + '55' : 'rgba(14,23,38,0.08)'}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{o.icon}</span>
            <span style={{ fontFamily: 'Manrope', fontSize: 12.5, fontWeight: outcome === o.id ? 700 : 500, color: outcome === o.id ? o.color : '#0E1726' }}>
              {o.label}
            </span>
          </button>
        ))}
      </div>

      {cfg?.needsReason && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Причина отказа</span>
          <select value={lostReason} onChange={e => { setLostReason(e.target.value); setError('') }} className="form-input" style={{ width: '100%' }}>
            <option value="">Выберите причину…</option>
            {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
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
            style={{ width: '100%', minHeight: 70, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Manrope', color: '#0E1726', resize: 'vertical', boxSizing: 'border-box' }}
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
          <input
            type="datetime-local"
            value={nextCall}
            onChange={e => setNextCall(e.target.value)}
            className="form-input"
            style={{ width: '100%' }}
          />
          {!nextCall && (
            <div style={{ fontSize: 11.5, color: '#A6AEB8', marginTop: 6 }}>
              Если не указать дату — бэкенд поставит её сам по каденции.
            </div>
          )}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#E0473B', marginBottom: 12 }}>{error}</div>}

      <button onClick={handleSave} disabled={saving || !outcome} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: 46, opacity: (!outcome || saving) ? 0.5 : 1 }}>
        {saving ? 'Сохраняю…' : 'Сохранить и следующий'}
      </button>
    </div>
  )
}
