import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'

const ToastContext = createContext(null)
// Список — отдельно: он нужен только колокольчику. Иначе каждое уведомление перерисовывало бы всех,
// кто вызывает show() (~70 компонентов). Всплывашек нет — уведомления только в колокольчике.
const NotificationsContext = createContext([])

export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const live = useRef(new Map())  // последнее состояние каждого уведомления — для update()

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    live.current.delete(id)
  }, [])

  // ToastProvider sits above AuthProvider so it survives sign-out/sign-in
  // on the same tab — without this, switching accounts on one device (e.g.
  // testing as director, then logging in as a manager) leaves the previous
  // account's notifications sitting in the bell for the next account.
  const clearAll = useCallback(() => {
    setNotifications([])
    live.current.clear()
  }, [])

  const show = useCallback((message, options = {}) => {
    const id = Date.now() + Math.random()
    const notification = {
      id,
      message,
      type: options.type || 'info',       // info | success | error | loading
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      created_at: new Date().toISOString(),
    }
    live.current.set(id, notification)
    setNotifications(prev => [notification, ...prev])
    return id
  }, [])

  // Обновить уже показанное уведомление: «Генерирую документ…» (type: 'loading') → «Готово» (success)
  const update = useCallback((id, patch) => {
    const cur = live.current.get(id)
    if (cur) {
      const next = { ...cur, ...patch }
      live.current.set(id, next)
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }, [])

  const actions = useMemo(() => ({ show, update, dismiss, clearAll }), [show, update, dismiss, clearAll])

  return (
    <ToastContext.Provider value={actions}>
    <NotificationsContext.Provider value={notifications}>
      {children}
    </NotificationsContext.Provider>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
export const useNotifications = () => useContext(NotificationsContext)
