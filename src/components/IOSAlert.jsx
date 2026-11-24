import { useDialogFocus } from './GlassDialog'
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { haptic } from '../motion'

// Подтверждение в стиле iOS 26 вместо системного window.confirm:
//   if (!(await iosConfirm('Удалить заявку?'))) return
// Заголовок — первое предложение, остальное — пояснение. «Удалить/Снять/Отключить» — красная кнопка.
function Alert({ message, okLabel, cancelLabel, destructive, onDone }) {
  const [closing, setClosing] = useState(false)
  const alertRef = useRef(null)
  const text = String(message || '')
  const m = text.match(/^(.+?[?.!])(\s+[\s\S]*)?$/)
  const title = m ? m[1] : text
  const body = m && m[2] ? m[2].trim() : ''
  const finish = (v) => { if (closing) return; setClosing(true); haptic(8); setTimeout(() => onDone(v), 160) }
  useDialogFocus(alertRef, () => finish(false), 2)
  return (
    <div className="ios-alert-scrim" data-closing={closing} onMouseDown={() => finish(false)}>
      <div ref={alertRef} tabIndex={-1} className="ios-alert glass-dialog" role="alertdialog" aria-modal="true" aria-label={title} onMouseDown={e => e.stopPropagation()}>
        <div className="ios-alert-title">{title}</div>
        {body && <div className="ios-alert-body">{body}</div>}
        <div className="ios-alert-actions">
          {cancelLabel && <button data-dialog-initial className="ios-alert-btn" onClick={() => finish(false)}>{cancelLabel}</button>}
          <button data-dialog-initial={cancelLabel ? undefined : true} className={`ios-alert-btn ios-alert-btn--${destructive ? 'danger' : 'primary'}`} onClick={() => finish(true)}>{okLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function iosConfirm(message, opts = {}) {
  const destructive = opts.destructive ?? /удал|снять|отключ|убрать|не сохранятся/i.test(String(message))
  const okLabel = opts.okLabel || (/не сохранятся/i.test(String(message)) ? 'Закрыть' : /^\s*удал/i.test(String(message)) ? 'Удалить'
    : /^\s*снять/i.test(String(message)) ? 'Снять' : /^\s*отключ/i.test(String(message)) ? 'Отключить' : /^\s*убрать/i.test(String(message)) ? 'Убрать' : 'Да')
  return new Promise((resolve) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    root.render(<Alert message={message} okLabel={okLabel} cancelLabel={opts.cancelLabel === null ? null : (opts.cancelLabel || 'Отмена')} destructive={destructive}
      onDone={(v) => { root.unmount(); host.remove(); resolve(v) }} />)
  })
}

// Сообщение об ошибке с одной кнопкой: «Не удалось удалить. Проверьте интернет…»
// Перед созданием: показать похожие записи и спросить. Проверка не прошла — не мешаем создавать.
export async function confirmNoDuplicates(find, what) {
  const dups = await find().catch(() => [])
  if (!dups.length) return true
  const list = dups.map(d => `• ${d.name}${d.phone ? ` — ${d.phone}` : ''}`).join('\n')
  return iosConfirm(`Похоже, ${what} уже есть в базе.\n${list}\n\nВсё равно создать?`, { okLabel: 'Создать', destructive: false })
}

export const iosError = (message) => iosConfirm(message, { okLabel: 'Понятно', cancelLabel: null, destructive: false })
