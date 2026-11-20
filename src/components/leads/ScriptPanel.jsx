import { useState, useEffect } from 'react'
import { getScripts, saveScripts } from '../../api'
import { stageById } from '../../constants/leads'
import { SwapText } from '../Transitions'

export default function ScriptPanel({ stage, lead }) {
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

  // Достаём обоснование и скрипт либо из полей лида, либо парсим из заметок (если поле отсеялось)
  const reason = lead?.selection_reason ||
    lead?.notes?.match(/💡 Почему взят:\s*([^\n]+)/)?.[1] ||
    lead?.notes?.match(/Почему взят:\s*([^\n]+)/)?.[1] ||
    (lead?.niche ? `Целевая коммерческая компания из Минска (${lead.niche}), регулярные поставки в РФ.` : '')

  const pitch = lead?.pitch_script ||
    lead?.notes?.match(/🎯 Скрипт:\s*([^\n]+)/)?.[1] ||
    lead?.notes?.match(/Скрипт:\s*([^\n]+)/)?.[1]

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
    return (
      <button onClick={() => setCollapsed(false)} className="card" style={{
        border: 'none', cursor: 'pointer', width: '100%', minHeight: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>
        <span style={{ fontFamily: 'var(--font-sys)', fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>Показать скрипт</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    )
  }

  return (
    <div className="card call-sheet" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {reason && (
        <div style={{
          padding: '12px 14px', borderRadius: 14,
          background: 'rgba(48, 209, 88, 0.07)',
          border: '0.5px solid rgba(48, 209, 88, 0.24)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1e9e5a)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Почему взят этот клиент
            </span>
            <a
              href={lead?.source_url || `https://2gis.by/minsk/search/${encodeURIComponent(lead?.company || lead?.name || '')}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1366f0)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
              title="Открыть источник компании"
            >
              Источник: {lead?.source || '2ГИС Минск'} ↗
            </a>
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.48, fontWeight: 500 }}>
            {reason}
          </div>
        </div>
      )}

      {pitch && (
        <div style={{
          padding: '12px 14px', borderRadius: 14,
          background: 'rgba(10, 132, 255, 0.07)',
          border: '0.5px solid rgba(10, 132, 255, 0.24)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-1366f0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Скрипт звонка
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5 }}>
            "{pitch}"
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          Общий скрипт стадии <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>({st.label})</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!editing && (
            <button onClick={startEdit} title="Редактировать" aria-label="Редактировать" className="call-icon-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
          )}
          <button onClick={() => setCollapsed(true)} title="Свернуть" aria-label="Свернуть" className="call-icon-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{ width: '100%', minHeight: 260, padding: 12, borderRadius: 12, border: '1px solid rgba(var(--ink-rgb), 0.12)', background: 'var(--fill)', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box', whiteSpace: 'pre-wrap' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditing(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Отмена</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}><SwapText>{saving ? 'Сохраняю…' : 'Сохранить'}</SwapText></button>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: 'var(--font-sys)', fontSize: 14, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {text || 'Нет скрипта для этой стадии.'}
        </div>
      )}
    </div>
  )
}
