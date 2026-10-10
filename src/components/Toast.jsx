import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { ThinkingOrb } from 'thinking-orbs'

const ToastContext = createContext(null)
// Список — отдельно: он нужен только колокольчику. Иначе каждое уведомление перерисовывало бы
// всех, кто вызывает show() (~70 компонентов), и всплывашка выезжала бы рывком.
const NotificationsContext = createContext([])

// Значки в духе SF Symbols (checkmark.circle.fill, exclamationmark.triangle.fill, info.circle.fill):
// цветная заливка с белым знаком, нарисованы заново — сами SF Symbols разрешены только в приложениях Apple.
const ICONS = {
  success: ['#34C759', <g key="i"><circle cx="12" cy="12" r="11" /><path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></g>],
  error: ['#FF3B30', <g key="i"><path d="M10.27 2.9a2 2 0 0 1 3.46 0l9.03 15.6A2 2 0 0 1 21.03 21.5H2.97a2 2 0 0 1-1.73-3l9.03-15.6z" /><path d="M12 8.6v5.4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" /><circle cx="12" cy="17.6" r="1.35" fill="#fff" /></g>],
  info: ['#0A84FF', <g key="i"><circle cx="12" cy="12" r="11" /><circle cx="12" cy="7.4" r="1.45" fill="#fff" /><path d="M12 11v6.2" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" /></g>],
  loading: ['#8E8E93', null],
}
const TITLES = { success: 'Готово', error: 'Ошибка', info: 'А2 CRM', loading: 'В процессе' }
const Icon = ({ kind }) => {
  const [color, glyph] = ICONS[kind]
  return (
    <span className="notif-icon">
      {kind === 'loading'
        ? <ThinkingOrb state="working" size={20} theme="light" aria-label="В процессе" />
        : <svg width="26" height="26" viewBox="0 0 24 24" fill={color} aria-hidden="true">{glyph}</svg>}
    </span>
  )
}

// Всплывашка (Sonner: стопка, смахивание, пауза при наведении) + запись в колокольчике (Topbar),
// где уведомление лежит, пока его не уберут. Закрытая всплывашка из колокольчика не пропадает.
const pop = (n) => {
  const kind = ICONS[n.type] ? n.type : 'info'
  toast(TITLES[kind], {
    id: n.id,  // то же id — update() перерисовывает ту же всплывашку («Генерирую…» → «Готово»)
    description: n.message,
    icon: <Icon kind={kind} />,
    duration: kind === 'loading' ? Infinity : n.onAction ? 6000 : 3500,
    dismissible: kind !== 'loading',
    action: n.actionLabel && n.onAction ? { label: n.actionLabel, onClick: n.onAction } : undefined,
  })
}

export function ToastProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const live = useRef(new Map())  // последнее состояние каждого уведомления — для update()

  const dismiss = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    live.current.delete(id)
    toast.dismiss(id)
  }, [])

  // ToastProvider sits above AuthProvider so it survives sign-out/sign-in
  // on the same tab — without this, switching accounts on one device (e.g.
  // testing as director, then logging in as a manager) leaves the previous
  // account's notifications sitting in the bell for the next account.
  const clearAll = useCallback(() => {
    setNotifications([])
    live.current.clear()
    toast.dismiss()
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
    pop(notification)
    return id
  }, [])

  // Обновить уже показанное уведомление: «Генерирую документ…» (type: 'loading') → «Готово» (success)
  const update = useCallback((id, patch) => {
    const cur = live.current.get(id)
    if (cur) {
      const next = { ...cur, ...patch }
      live.current.set(id, next)
      pop(next)
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }, [])

  const actions = useMemo(() => ({ show, update, dismiss, clearAll }), [show, update, dismiss, clearAll])

  return (
    <ToastContext.Provider value={actions}>
    <NotificationsContext.Provider value={notifications}>
      {children}
      {/* справа сверху под колокольчиком; на телефоне Sonner сам растягивает на ширину экрана */}
      <Toaster position="top-right" offset={{ top: 84, right: 24 }} mobileOffset={{ top: 'calc(10px + env(safe-area-inset-top))' }}
        visibleToasts={4} gap={8} toastOptions={{ unstyled: true, classNames: { toast: 'notif', title: 'notif-title', description: 'notif-text', actionButton: 'notif-action', icon: 'notif-icon-slot' } }} />
    </NotificationsContext.Provider>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
export const useNotifications = () => useContext(NotificationsContext)
