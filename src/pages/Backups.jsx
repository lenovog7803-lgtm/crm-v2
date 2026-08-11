import { useState, useEffect } from 'react'
import { getBackups, restoreBackup, createBackupNow } from '../api'
import { useToast } from '../components/Toast'
import { useEscapeKey } from '../hooks/useEscapeKey'

function reasonLabel(reason) {
  if (reason === 'scheduled') return 'плановый'
  if (reason === 'startup') return 'при запуске'
  if (reason === 'manual') return 'вручную'
  if (reason && reason.startsWith('pre_restore_')) return 'перед восстановлением'
  return reason || '—'
}

export default function Backups() {
  const { show } = useToast()
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState(null)
  useEscapeKey(() => setRestoreTarget(null), !!restoreTarget)
  const [confirmWord, setConfirmWord] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    setForbidden(false)
    getBackups()
      .then(r => setBackups(Array.isArray(r) ? r : []))
      .catch(e => {
        if (String(e.message || '').includes('администратора') || String(e.message || '').includes('403')) setForbidden(true)
        else show('Ошибка загрузки бэкапов: ' + e.message, { type: 'error' })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const doCreate = async () => {
    setCreating(true)
    try {
      await createBackupNow()
      show('Бэкап создан', { type: 'success' })
      load()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setCreating(false)
  }

  const doRestore = async () => {
    setRestoring(true)
    try {
      const res = await restoreBackup(restoreTarget.id, confirmWord)
      show(`Восстановлено: ${Object.entries(res.restored || {}).map(([k, v]) => `${k} ${v}`).join(', ')}`, { type: 'success' })
      setRestoreTarget(null)
      setConfirmWord('')
      load()
    } catch (e) {
      show('Ошибка: ' + e.message, { type: 'error' })
    }
    setRestoring(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 20, color: '#0E1726' }}>Резервные копии</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Автоматический снимок раз в сутки, хранятся последние 30</div>
        </div>
        {!forbidden && (
          <button
            onClick={doCreate}
            disabled={creating}
            style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(19,102,240,0.25)', background: 'rgba(19,102,240,0.08)', color: '#1366F0', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          >
            {creating ? 'Создаю…' : 'Создать сейчас'}
          </button>
        )}
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#A6AEB8' }}>Загрузка…</div>}

      {!loading && forbidden && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#5A6573' }}>Резервные копии доступны только администратору</div>
        </div>
      )}

      {!loading && !forbidden && backups.length === 0 && (
        <div className="card" style={{ padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#A6AEB8' }}>Бэкапов пока нет</div>
        </div>
      )}

      {!loading && !forbidden && backups.map(b => (
        <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#FFFFFF', borderRadius: 14, border: '1px solid rgba(14,23,38,0.06)', marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726' }}>
              {new Date(b.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' в '}
              {new Date(b.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 11, color: '#8A93A0', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {reasonLabel(b.reason)}
              {b.counts && ` · ${Object.entries(b.counts).map(([k, v]) => `${k}: ${v}`).join(' · ')}`}
            </div>
          </div>
          <button
            onClick={() => setRestoreTarget(b)}
            style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(224,71,59,0.3)', background: 'rgba(224,71,59,0.06)', color: '#E0473B', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}
          >
            Восстановить
          </button>
        </div>
      ))}

      {restoreTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
          <div style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 440, padding: 26 }}>
            <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 17, color: '#E0473B', marginBottom: 8 }}>Восстановить из бэкапа?</div>
            <div style={{ fontSize: 13, color: '#5A6573', marginBottom: 18, lineHeight: 1.5 }}>
              Это заменит текущие данные снимком от{' '}
              {new Date(restoreTarget.created_at).toLocaleDateString('ru-RU')}. Текущее состояние тоже будет сохранено отдельным бэкапом на случай ошибки.
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Введите слово ВОССТАНОВИТЬ
            </div>
            <input
              value={confirmWord}
              onChange={e => setConfirmWord(e.target.value)}
              placeholder="ВОССТАНОВИТЬ"
              autoFocus
              style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #E8EAEE', background: '#F7F8FA', fontSize: 14, boxSizing: 'border-box', marginBottom: 18 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRestoreTarget(null)} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
              <button
                onClick={doRestore}
                disabled={confirmWord.trim().toUpperCase() !== 'ВОССТАНОВИТЬ' || restoring}
                style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: confirmWord.trim().toUpperCase() === 'ВОССТАНОВИТЬ' ? '#E0473B' : '#E8EAEE', color: confirmWord.trim().toUpperCase() === 'ВОССТАНОВИТЬ' ? '#FFFFFF' : '#8A93A0', fontWeight: 700, cursor: 'pointer' }}
              >
                {restoring ? 'Восстанавливаю…' : 'Подтвердить восстановление'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
