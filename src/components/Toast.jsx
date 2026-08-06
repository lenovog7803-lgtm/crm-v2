import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

// No more floating popups — every show() lands in the bell dropdown
// (rendered by Topbar) and stays there until the user dismisses it.
export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const show = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random()
    const notification = {
      id,
      message,
      type: options.type || 'info',       // info | success | error
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      created_at: new Date().toISOString(),
    }
    setNotifications(prev => [notification, ...prev])
    return id
  }, [])

  return (
    <ToastContext.Provider value={{ notifications, show, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
