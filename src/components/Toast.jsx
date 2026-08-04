import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random()
    const toast = {
      id,
      message,
      type: options.type || 'info',       // info | success | error
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      duration: options.duration ?? (options.actionLabel ? 6000 : 3200),
    }
    setToasts(prev => [...prev, toast])
    if (!options.persistent) {
      setTimeout(() => dismiss(id), toast.duration)
    }
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 10,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const accent = t.type === 'error' ? '#E0473B' : t.type === 'success' ? '#1E9E5A' : '#1366F0'
          const tint = t.type === 'error' ? 'rgba(224,71,59,0.1)' : t.type === 'success' ? 'rgba(30,158,90,0.1)' : 'rgba(19,102,240,0.08)'
          return (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 12,
            background: `linear-gradient(${tint}, ${tint}), rgba(255,255,255,0.6)`,
            backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: `1px solid ${accent}40`,
            borderRadius: 16,
            padding: '11px 14px',
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 16px 40px -16px rgba(20,30,55,0.35)`,
            minWidth: 280,
            maxWidth: 440,
            animation: 'toastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 9, flexShrink: 0,
              background: `${accent}26`, border: `1px solid ${accent}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.type === 'success' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {t.type === 'error' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              )}
              {t.type === 'info' && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="16" x2="12" y2="11" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              )}
            </div>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#0E1726', lineHeight: 1.4 }}>{t.message}</div>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id) }}
                style={{ fontSize: 12, fontWeight: 700, color: accent, background: `${accent}1A`, border: 'none', borderRadius: 9, padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              style={{ width: 20, height: 20, border: 'none', background: 'transparent', color: '#8A93A0', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
            >×</button>
          </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
