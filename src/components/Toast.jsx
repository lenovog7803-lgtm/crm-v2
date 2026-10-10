import { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react'
import { Toaster, toast } from 'sonner'
import { ThinkingOrb } from 'thinking-orbs'

const ToastContext = createContext(null)
// Список — отдельно: он нужен только колокольчику. Иначе каждое уведомление перерисовывало бы
// всех, кто вызывает show() (~70 компонентов), и всплывашка выезжала бы рывком.
const NotificationsContext = createContext([])

// Значок уведомления — цветной «квадратик» как у приложений в уведомлениях iOS.
const ICONS = {
  success: ['#34C759', '#248A3D', <polyline key="i" points="20 6 9 17 4 12" />],
  error: ['#FF453A', '#D70015', <g key="i"><line x1="12" y1="7" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>],
  info: ['#0A84FF', '#0060DF', <g key="i"><line x1="12" y1="16" x2="12" y2="11" /><line x1="12" y1="8" x2="12.01" y2="8" /></g>],
  loading: ['#8E8E93', '#636366', null],
}
const TITLES = { success: 'Готово', error: 'Ошибка', info: 'А2 CRM', loading: 'В процессе' }
const Icon = ({ kind }) => {
  const [a, b, path] = ICONS[kind]
  return (
    <span className="notif-icon" style={{ background: `linear-gradient(160deg, ${a}, ${b})`, boxShadow: `0 2px 6px -1px ${b}77, inset 0 1px 0 rgba(255,255,255,0.3)` }}>
      {kind === 'loading'
        ? <ThinkingOrb state="working" size={20} color="#fff" aria-label="В процессе" />
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{path}</svg>}
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
