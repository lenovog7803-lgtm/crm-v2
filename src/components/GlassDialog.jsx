import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const dialogStack = []
const focusable = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex], [contenteditable="true"]'

export function useDialogFocus(ref, onDismiss, priority = 0) {
  const opener = useRef(document.activeElement)
  const dismiss = useRef(onDismiss)

  useLayoutEffect(() => { dismiss.current = onDismiss }, [onDismiss])
  useLayoutEffect(() => {
    const panel = ref.current
    const entry = { panel, priority }
    dialogStack.push(entry)
    dialogStack.sort((a, b) => a.priority - b.priority)
    if (!panel.contains(document.activeElement)) {
      (panel.querySelector('[data-dialog-initial]') || panel).focus({ preventScroll: true })
    }

    const handleKey = event => {
      if (event.defaultPrevented || dialogStack.at(-1) !== entry) return
      if (event.key === 'Escape' && dismiss.current) {
        event.preventDefault()
        event.stopPropagation()
        dismiss.current()
      }
      if (event.key !== 'Tab') return
      const active = document.activeElement
      const items = [...panel.querySelectorAll(focusable)].filter(el =>
        el.tabIndex >= 0 && el.getClientRects().length && !el.closest('[hidden], [inert]'))
      const edge = event.shiftKey ? items[0] : items.at(-1)
      if (panel.contains(active) && active !== panel && active !== edge && items.length) return
      event.preventDefault()
      const next = (event.shiftKey ? items.at(-1) : items[0]) || panel
      next.focus({ preventScroll: true })
    }

    document.addEventListener('keydown', handleKey)
    return () => {
      const wasTop = dialogStack.at(-1) === entry
      dialogStack.splice(dialogStack.indexOf(entry), 1)
      document.removeEventListener('keydown', handleKey)
      if (wasTop && opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
  }, [ref, priority])
}

export default function GlassDialog({ className, onDismiss, label, ...props }) {
  const panel = useRef(null)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  const close = () => {
    if (leaving) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDismiss()
      return
    }
    setLeaving(true)
    timer.current = setTimeout(() => {
      onDismiss()
      setLeaving(false)
    }, 150)
  }
  const onClickCapture = event => {
    if (!event.target.closest('[data-dialog-dismiss]')) return
    event.stopPropagation()
    close()
  }

  useDialogFocus(panel, className === 'spotlight' ? onDismiss : close, className === 'spotlight' ? 1 : 0)
  return <div {...props} ref={panel} className={`glass-dialog ${className}`} data-dialog-leaving={leaving}
    onClickCapture={onClickCapture} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} />
}
