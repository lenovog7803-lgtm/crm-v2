import { ThinkingOrb } from 'thinking-orbs'

// Единый индикатор загрузки — точечная «сфера» (thinking-orbs). В CRM нет тёмной темы,
// поэтому theme="light": тёмные точки на светлом фоне. Сама уважает prefers-reduced-motion.
// state — характер анимации под смысл места: working (данные), searching (поиск/очередь),
// listening (почта), composing (отчёты, аналитика), weaving (бэкапы), breathing (запуск CRM).
export function Loader({ label = 'Загрузка…', state = 'working', padding = 40, style }) {
  return (
    <div role="status" style={{ padding, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, color: '#A6AEB8', fontSize: 13, ...style }}>
      {/* сфера нарисована на 64 px — показываем крупнее (80 px), под размер карточек CRM */}
      <div style={{ width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThinkingOrb state={state} size={64} theme="light" aria-label={label} style={{ transform: 'scale(1.25)' }} />
      </div>
      {label && <span>{label}</span>}
    </div>
  )
}

// Маленькая сфера в строку текста — вместо «Загрузка…» внутри подписи.
export function InlineLoader({ label = 'Загрузка…', state = 'working' }) {
  return (
    <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' }}>
      <ThinkingOrb state={state} size={20} theme="light" aria-label={label} />
      {label}
    </span>
  )
}
