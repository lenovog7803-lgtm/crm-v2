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
        zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center', pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 14,
            background: '#FFFFFF',
            border: `1px solid ${t.type === 'error' ? 'rgba(224,71,59,0.3)' : t.type === 'success' ? 'rgba(30,158,90,0.3)' : 'rgba(14,23,38,0.1)'}`,
            borderRadius: 14,
            padding: '12px 16px',
            boxShadow: '0 12px 32px rgba(20,30,55,0.18)',
            minWidth: 280,
            maxWidth: 440,
            animation: 'toastIn 0.2s ease',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4, flexShrink: 0,
              background: t.type === 'error' ? '#E0473B' : t.type === 'success' ? '#1E9E5A' : '#1366F0',
            }} />
            <div style={{ flex: 1, fontSize: 13, color: '#0E1726', lineHeight: 1.4 }}>{t.message}</div>
            {t.actionLabel && (
              <button
                onClick={() => { t.onAction?.(); dismiss(t.id) }}
                style={{ fontSize: 12, fontWeight: 700, color: '#1366F0', background: 'transparent', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                {t.actionLabel}
              </button>
            )}
            <button
              onClick={() => dismiss(t.id)}
              style={{ width: 20, height: 20, border: 'none', background: 'transparent', color: '#8A93A0', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}
            >×</button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
