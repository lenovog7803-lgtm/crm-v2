import { useState, useEffect } from 'react'
import { getBackups, restoreBackup, createBackupNow, getImportPreview, applyImportFromSheets } from '../api'
import { useToast } from '../components/Toast'
import { useEscapeKey } from '../hooks/useEscapeKey'

function fieldVal(v) {
  if (v === null || v === undefined || v === '') return '—'
  if (v === true) return 'да'
  if (v === false) return 'нет'
  return String(v)
}

function ImportPreviewModal({ preview, onClose, onConfirm, applying }) {
  useEscapeKey(onClose, true)
  const orders = preview.orders || {}
  const hasDeletes = (orders.would_delete || []).length > 0
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,23,38,0.55)', backdropFilter: 'blur(6px)', zIndex: 1000, overflowY: 'auto', display: 'grid', padding: 24 }}>
      <div style={{ margin: 'auto', background: '#FFFFFF', borderRadius: 24, width: '100%', maxWidth: 640, padding: 26, maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 17, color: '#0E1726', marginBottom: 4 }}>Что изменится при импорте из Таблицы</div>
        <div style={{ fontSize: 12, color: '#8A93A0', marginBottom: 16 }}>Ничего ещё не применено — только предпросмотр</div>

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(19,102,240,0.08)', color: '#1366F0', fontSize: 12, fontWeight: 600 }}>
              Новых заявок: {(orders.new || []).length}
            </div>
            <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(19,102,240,0.08)', color: '#1366F0', fontSize: 12, fontWeight: 600 }}>
              Изменится: {(orders.changed || []).length}
            </div>
            <div style={{ padding: '6px 12px', borderRadius: 10, background: hasDeletes ? 'rgba(224,71,59,0.1)' : 'rgba(14,23,38,0.05)', color: hasDeletes ? '#E0473B' : '#8A93A0', fontSize: 12, fontWeight: 600 }}>
              Будет удалено: {(orders.would_delete || []).length}
            </div>
            {preview.clients && (
              <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(14,23,38,0.05)', color: '#5A6573', fontSize: 12, fontWeight: 600 }}>
                Новых клиентов: {preview.clients.new}
              </div>
            )}
            {preview.carriers && (
              <div style={{ padding: '6px 12px', borderRadius: 10, background: 'rgba(14,23,38,0.05)', color: '#5A6573', fontSize: 12, fontWeight: 600 }}>
                Новых перевозчиков: {preview.carriers.new}
              </div>
            )}
          </div>

          {hasDeletes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E0473B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                Будут помечены удалёнными (не найдены в Таблице)
              </div>
              <div style={{ fontSize: 13, color: '#5A6573', lineHeight: 1.7, wordBreak: 'break-word' }}>
                {orders.would_delete.join(', ')}
              </div>
            </div>
          )}

          {(orders.changed || []).length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                Изменённые заявки
              </div>
              {orders.changed.map(c => (
                <div key={c.order_number} style={{ padding: '10px 12px', background: '#F7F8FA', borderRadius: 12, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0E1726', marginBottom: 4 }}>{c.order_number}</div>
                  {c.diffs.map((d, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#5A6573' }}>
                      {d.label}: <span style={{ color: '#A6AEB8' }}>{fieldVal(d.old)}</span> → <span style={{ color: '#0E1726', fontWeight: 600 }}>{fieldVal(d.new)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {(orders.new || []).length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8A93A0', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                Новые заявки
              </div>
              <div style={{ fontSize: 13, color: '#5A6573', lineHeight: 1.7, wordBreak: 'break-word' }}>
                {orders.new.join(', ')}
              </div>
            </div>
          )}

          {(orders.new || []).length === 0 && (orders.changed || []).length === 0 && !hasDeletes && (
            <div style={{ padding: 30, textAlign: 'center', color: '#A6AEB8', fontSize: 13 }}>Изменений нет</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 13, borderRadius: 12, background: '#F7F8FA', border: '1px solid #E8EAEE', color: '#5A6573', cursor: 'pointer' }}>Отмена</button>
          <button
            onClick={onConfirm}
            disabled={applying}
            style={{ flex: 2, padding: 13, borderRadius: 12, border: 'none', background: '#1366F0', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
          >
            {applying ? 'Применяю…' : 'Применить изменения'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const [importPreview, setImportPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [applying, setApplying] = useState(false)

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

  const doPreview = async () => {
    setPreviewing(true)
    try {
      const r = await getImportPreview()
      setImportPreview(r)
    } catch (e) {
      show('Ошибка предпросмотра: ' + e.message, { type: 'error' })
    }
    setPreviewing(false)
  }

  const doApplyImport = async () => {
    setApplying(true)
    try {
      const res = await applyImportFromSheets()
      show(`Импорт применён: ${Object.entries(res.imported || {}).map(([k, v]) => `${k} ${v}`).join(', ')}`, { type: 'success' })
      setImportPreview(null)
    } catch (e) {
      show('Ошибка импорта: ' + e.message, { type: 'error' })
    }
    setApplying(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 20, color: '#0E1726' }}>Резервные копии</div>
          <div style={{ fontSize: 12, color: '#8A93A0', marginTop: 2 }}>Автоматический снимок раз в сутки, хранятся последние 30</div>
        </div>
        {!forbidden && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={doPreview}
              disabled={previewing}
              style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(14,23,38,0.12)', background: '#FFFFFF', color: '#0E1726', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {previewing ? 'Проверяю…' : 'Импорт из Таблицы'}
            </button>
            <button
              onClick={doCreate}
              disabled={creating}
              style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid rgba(19,102,240,0.25)', background: 'rgba(19,102,240,0.08)', color: '#1366F0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              {creating ? 'Создаю…' : 'Создать сейчас'}
            </button>
          </div>
        )}
      </div>

      {importPreview && (
        <ImportPreviewModal
          preview={importPreview}
          onClose={() => setImportPreview(null)}
          onConfirm={doApplyImport}
          applying={applying}
        />
      )}

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
