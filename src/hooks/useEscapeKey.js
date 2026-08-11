import { useEffect } from 'react'

// Closes whatever's open on Escape. Call unconditionally with the modal's
// open flag — the effect itself no-ops (and detaches) when closed, so this
// is safe to call from every render without an `if (open)` wrapper at the
// call site.
export function useEscapeKey(onClose, open = true) {
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])
}
