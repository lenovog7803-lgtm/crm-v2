import { useState, useEffect } from 'react'
import { logCall, getCallHistory } from '../api'
import { ModalOverlay, ModalHeader } from './Modal'

const OUTCOMES = [
  { id: 'no_answer', label: 'Не взял трубку', icon: '📵', color: '#8A93A0', bg: 'rgba(138,147,160,0.10)', needsComment: false, needsDate: false },
  { id: 'callback',  label: 'Перезвонить',    icon: '🔄', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   needsComment: true,  needsDate: true  },
  { id: 'thinking',  label: 'Думает',         icon: '🤔', color: '#D97706', bg: 'rgba(217,119,6,0.12)',   needsComment: true,  needsDate: true  },
  { id: 'kp_sent',   label: 'КП отправлено',  icon: '📤', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)',  needsComment: true,  needsDate: true  },
  { id: 'won',       label: 'Стал клиентом',  icon: '✅', color: '#1E9E5A', bg: 'rgba(30,158,90,0.12)',   needsComment: true,  needsDate: false },
  { id: 'lost',      label: 'Отказ',          icon: '✕',  color: '#E0473B', bg: 'rgba(224,71,59,0.12)',   needsComment: true,  needsDate: false },
]

const DATE_PRESETS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 3 дня', days: 3 },
  { label: 'Через неделю', days: 7 },
  { label: 'Через месяц', days: 30 },
]

const labelStyle = { fontSize: 10, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, display: 'block' }

export default function CallModal({ lead, onClose, onSaved }) {
  const [outcome, setOutcome] = useState(null)
  const [comment, setComment] = useState('')
  const [nextCall, setNextCall] = useState('')
  const [history, setHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getCallHistory(lead.id).then(r => setHistory(r.calls || [])).catch(() => {})
  }, [lead.id])

  const cfg = OUTCOMES.find(o => o.id === outcome)
  const attempts = lead.call_attempts || 0

  const setPreset = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    d.setHours(10, 0, 0, 0)
    setNextCall(d.toISOString().slice(0, 16))
  }

  const handleSave = async () => {
    if (!outcome) { setError('Выберите результат звонка'); return }
    if (cfg.needsComment && !comment.trim()) { setError('Напишите комментарий'); return }
    if (cfg.needsDate && !nextCall) { setError('Укажите дату следующего звонка'); return }

    setSaving(true)
    setError('')
    try {
      await logCall(lead.id, {
        outcome,
        comment: comment.trim(),
        next_call: nextCall ? new Date(nextCall).toISOString() : null,
      })
      onSaved?.()
      onClose()
    } catch (e) {
      setError(e.message || 'Ошибка сохранения')
    }
    setSaving(false)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalHeader title={lead.name || 'Лид'} onClose={onClose} />

      <div style={{ marginTop: -12, marginBottom: 18 }}>
        <div style={{ fontFamily: 'JetBrains Mono', fontSize: 15, color: '#1366F0' }}>{lead.phone || '—'}</div>
        <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 3 }}>
          {lead.contact_person ? `${lead.contact_person} · ` : ''}
          {lead.industry || 'Отрасль не указана'}
          {attempts > 0 ? ` · попыток дозвона: ${attempts}` : ''}
        </div>
      </div>

      {attempts >= 3 && (
        <div style={{ background: 'rgba(224,71,59,0.08)', border: '1px solid rgba(224,71,59,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#E0473B' }}>
          {attempts} неудачных дозвона подряд. После {5}-й попытки лид уйдёт в «Нет контакта».
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>Прошлые звонки</span>
          {history.slice(0, 3).map((h, i) => {
            const o = OUTCOMES.find(x => x.id === h.outcome)
            return (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(14,23,38,0.03)', borderRadius: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 14, flexShrink: 0 }}>{o?.icon || '📞'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: o?.color || '#8A93A0', fontWeight: 600 }}>
                    {o?.label || h.outcome} · {new Date(h.created_at).toLocaleDateString('ru-RU')}
                  </div>
                  {h.comment && <div style={{ fontSize: 12, color: '#5A6573', marginTop: 2 }}>{h.comment}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <span style={labelStyle}>Результат звонка</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
        {OUTCOMES.map(o => (
          <button
            key={o.id}
            onClick={() => { setOutcome(o.id); setError(''); if (!o.needsDate) setNextCall('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', borderRadius: 12,
              background: outcome === o.id ? o.bg : 'rgba(255,255,255,0.6)',
              border: `1.5px solid ${outcome === o.id ? o.color + '55' : 'rgba(14,23,38,0.08)'}`,
              cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 15 }}>{o.icon}</span>
            <span style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: outcome === o.id ? 600 : 400, color: outcome === o.id ? o.color : '#0E1726' }}>
              {o.label}
            </span>
          </button>
        ))}
      </div>

      {cfg?.needsDate && (
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>Когда перезвонить</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {DATE_PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => setPreset(p.days)}
                style={{ padding: '7px 13px', borderRadius: 20, fontSize: 12, fontFamily: 'Manrope', background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(14,23,38,0.1)', color: '#5A6573', cursor: 'pointer' }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={nextCall}
            onChange={e => setNextCall(e.target.value)}
            style={{ width: '100%', padding: '10px 13px', borderRadius: 11, border: '1px solid rgba(14,23,38,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Manrope', color: '#0E1726', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {outcome && outcome !== 'no_answer' && (
        <div style={{ marginBottom: 18 }}>
          <span style={labelStyle}>Комментарий после звонка *</span>
          <textarea
            value={comment}
            onChange={e => { setComment(e.target.value); setError('') }}
            placeholder="О чём говорили, что решили, когда возвращаться…"
            autoFocus
            style={{ width: '100%', minHeight: 88, padding: '11px 13px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: 'rgba(255,255,255,0.8)', fontSize: 13, fontFamily: 'Manrope', color: '#0E1726', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#E0473B', marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '13px', borderRadius: 12, background: 'rgba(14,23,38,0.04)', border: '1px solid rgba(14,23,38,0.08)', fontFamily: 'Manrope', fontSize: 14, color: '#5A6573', cursor: 'pointer' }}>
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !outcome}
          style={{ flex: 2, padding: '13px', borderRadius: 12, background: outcome ? '#1366F0' : 'rgba(14,23,38,0.1)', border: 'none', fontFamily: 'Manrope', fontSize: 14, fontWeight: 700, color: outcome ? '#fff' : '#8A93A0', cursor: outcome ? 'pointer' : 'not-allowed' }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить результат'}
        </button>
      </div>
    </ModalOverlay>
  )
}
