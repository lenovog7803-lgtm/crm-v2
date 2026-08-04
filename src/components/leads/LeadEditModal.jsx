import { useState } from 'react'
import { updateLead } from '../../api'
import { STAGES } from '../../constants/leads'

const labelStyle = { fontSize: 12, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.05em', marginBottom: 6, display: 'block' }
const fieldStyle = { width: '100%', background: '#F7F8FA' }

export default function LeadEditModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState({ ...lead })
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSave = async () => {
    if (!lead?.id) return
    setSaving(true)
    try {
      await updateLead(lead.id, {
        name: form.name,
        company: form.company,
        phone: form.phone,
        contact_person: form.contact_person,
        contact_position: form.contact_position,
        email: form.email,
        website: form.website,
        industry: form.industry,
        city: form.city,
        region: form.region,
        stage: form.stage,
        notes: form.notes,
      })
      onSaved?.({ ...lead, ...form })
      onClose()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,23,38,0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        overflowY: 'auto',
        display: 'grid',
        padding: 20,
      }}
    >
      <div style={{
        margin: 'auto',
        background: '#FFFFFF',
        borderRadius: 24,
        width: '100%', maxWidth: 560,
        border: '1px solid rgba(14,23,38,0.08)',
        boxShadow: '0 40px 80px rgba(20,30,55,0.28)',
      }}>
        <div style={{ padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 18, color: '#0E1726' }}>Редактировать лида</div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: '#F7F8FA', color: '#5A6573',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div>
              <label style={labelStyle}>НАЗВАНИЕ КОМПАНИИ</label>
              <input value={form.name || ''} onChange={set('name')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>ТЕЛЕФОН</label>
              <input value={form.phone || ''} onChange={set('phone')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>КОНТАКТНОЕ ЛИЦО</label>
              <input value={form.contact_person || ''} onChange={set('contact_person')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>ДОЛЖНОСТЬ</label>
              <input value={form.contact_position || ''} onChange={set('contact_position')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input value={form.email || ''} onChange={set('email')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>САЙТ</label>
              <input value={form.website || ''} onChange={set('website')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>ОТРАСЛЬ</label>
              <input value={form.industry || ''} onChange={set('industry')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>ГОРОД</label>
              <input value={form.city || ''} onChange={set('city')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>РЕГИОН</label>
              <input value={form.region || ''} onChange={set('region')} className="form-input" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>СТАДИЯ</label>
              <select value={form.stage || 'new'} onChange={set('stage')} className="form-input" style={fieldStyle}>
                {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>ЗАМЕТКИ</label>
            <textarea value={form.notes || ''} onChange={set('notes')} className="form-input" style={{ ...fieldStyle, height: 80, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', height: 44 }}>Отмена</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 2, justifyContent: 'center', height: 44 }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
