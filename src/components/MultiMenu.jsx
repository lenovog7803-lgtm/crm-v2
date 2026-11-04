import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Выпадающий список с несколькими галочками — тот же вид, что у обычного выбора (Select): стекло, ✓ у выбранного.
// items: [{ key, label }]; group — через сколько пунктов ставить разделитель.
export default function MultiMenu({ className, children, items, selected, onToggle, onClear, group = 0 }) {
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const open = !!pos

  const toggleOpen = () => {
    if (open) return setPos(null)
    const r = btnRef.current.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 6 })
  }
  useEffect(() => {
    if (!open) return
    const away = e => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setPos(null) }
    const esc = e => { if (e.key === 'Escape') setPos(null) }
    const close = () => setPos(null)
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc); window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); window.removeEventListener('resize', close) }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" className={`${className}${open ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={toggleOpen}>
        {children}
      </button>
      {open && createPortal(
        <div ref={menuRef} role="listbox" aria-multiselectable="true" className="apple-select-menu" style={{ left: pos.left, top: pos.top, transformOrigin: '20px top' }}>
          {items.map((it, i) => (
            <div key={it.key}>
              {group > 0 && i > 0 && i % group === 0 && <div className="apple-select-sep" />}
              <div role="option" aria-selected={selected.includes(it.key)} className="apple-select-item" style={{ cursor: 'pointer' }}
                onClick={() => onToggle(it.key)}
                onPointerEnter={e => e.currentTarget.setAttribute('data-active', 'true')}
                onPointerLeave={e => e.currentTarget.removeAttribute('data-active')}>
                <span className="apple-select-check">{selected.includes(it.key) ? '✓' : ''}</span>
                {it.label}
              </div>
            </div>
          ))}
          {selected.length > 0 && onClear && <>
            <div className="apple-select-sep" />
            <div role="option" aria-selected="false" className="apple-select-item" style={{ cursor: 'pointer', color: 'var(--fg-c81923)' }}
              onClick={() => { onClear(); setPos(null) }}
              onPointerEnter={e => e.currentTarget.setAttribute('data-active', 'true')}
              onPointerLeave={e => e.currentTarget.removeAttribute('data-active')}>
              <span className="apple-select-check" />Сбросить
            </div>
          </>}
        </div>,
        document.body,
      )}
    </>
  )
}
