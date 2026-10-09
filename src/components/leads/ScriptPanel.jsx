import { useState, useEffect } from 'react'
import { getScripts, saveScripts } from '../../api'
import { stageById } from '../../constants/leads'
import { SwapText } from '../Transitions'

export default function ScriptPanel({ stage }) {
  const [scripts, setScripts] = useState({})
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('leads_script_collapsed') === '1')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { getScripts().then(r => setScripts(r.scripts || {})).catch(() => {}) }, [])
  useEffect(() => { localStorage.setItem('leads_script_collapsed', collapsed ? '1' : '0') }, [collapsed])
  useEffect(() => { setEditing(false) }, [stage])

  const st = stageById(stage)
  const text = scripts[stage] || ''

  const startEdit = () => { setDraft(text); setEditing(true) }
  const save = async () => {
    setSaving(true)
    try {
      const next = { ...scripts, [stage]: draft }
      await saveScripts(next)
      setScripts(next)
      setEditing(false)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  if (collapsed) {
    // Fills the same grid column the expanded card would rather than
    // shrinking to a narrow vertical pill — a tiny button floating in an
    // otherwise-empty wide column looked broken, not "collapsed".
    return (
      <button onClick={() => setCollapsed(false)} className="card" style={{
        border: 'none', cursor: 'pointer', width: '100%', minHeight: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-sys)', fontWeight: 600, fontSize: 13, color: '#5A6573' }}>Показать скрипт</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A93A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    )
  }

  return (
    <div className="card call-sheet" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#0E1726', letterSpacing: '-0.01em' }}>
          Скрипт <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, background: st.bg || 'rgba(14,23,38,0.06)', color: st.color }}>{st.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!editing && (
            <button onClick={startEdit} title="Редактировать" className="call-icon-btn">✎</button>
          )}
          <button onClick={() => setCollapsed(true)} title="Свернуть" className="call-icon-btn">»</button>
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ width: '100%', minHeight: 260, padding: 12, borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: '#F7F8FA', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: '#0E1726', resize: 'vertical', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}><SwapText>{saving ? 'Сохраняю…' : 'Сохранить'}</SwapText></button>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-sys)', fontSize: 14.5, color: '#2A3342', whiteSpace: 'pre-wrap', lineHeight: 1.65, letterSpacing: '-0.005em' }}>
          {text || 'Нет скрипта для этой стадии.'}
        </div>
      )}
    </div>
  )
}
