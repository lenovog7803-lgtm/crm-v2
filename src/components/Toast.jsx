import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

// No more floating popups — every show() lands in the bell dropdown
// (rendered by Topbar) and stays there until the user dismisses it.
export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([])

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  // ToastProvider sits above AuthProvider so it survives sign-out/sign-in
  // on the same tab — without this, switching accounts on one device (e.g.
  // testing as director, then logging in as a manager) leaves the previous
  // account's notifications sitting in the bell for the next account.
  const clearAll = useCallback(() => {
    setNotifications([])
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
    <ToastContext.Provider value={{ notifications, show, dismiss, clearAll }}>
      {children}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
