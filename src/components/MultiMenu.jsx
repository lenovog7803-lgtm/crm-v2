import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Выпадающий список с несколькими галочками — тот же вид, что у обычного выбора (Select): стекло, ✓ у выбранного.
// items: [{ key, label }]; group — через сколько пунктов ставить разделитель.
export default function MultiMenu({ className, children, items, selected, onToggle, onClear, group = 0 }) {
  const [pos, setPos] = useState(null)
  const menuId = useId()
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
    menuRef.current?.querySelector('input')?.focus()
    const esc = e => {
      if (e.key !== 'Escape') return
      setPos(null)
      btnRef.current?.focus()
    }
    const close = () => setPos(null)
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc); window.addEventListener('resize', close)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); window.removeEventListener('resize', close) }
  }, [open])

  return (
    <>
      <button ref={btnRef} type="button" className={`${className}${open ? ' is-open' : ''}`} aria-controls={open ? menuId : undefined} aria-expanded={open} onClick={toggleOpen}>
        {children}
      </button>
      {open && createPortal(
        <div ref={menuRef} id={menuId} role="group" aria-label="Фильтр документов" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPos(null) }} className="apple-select-menu" style={{ left: pos.left, top: pos.top, transformOrigin: '20px top' }}>
          {items.map((it, i) => (
            <div key={it.key}>
              {group > 0 && i > 0 && i % group === 0 && <div className="apple-select-sep" />}
              <label className="apple-select-item filter-check">
                <input type="checkbox" checked={selected.includes(it.key)} onChange={() => onToggle(it.key)} />
                {it.label}
              </label>
            </div>
          ))}
          {selected.length > 0 && onClear && <>
            <div className="apple-select-sep" />
            <button type="button" className="apple-select-item filter-reset"
              onClick={() => { onClear(); setPos(null); btnRef.current?.focus() }}>
              Сбросить
            </button>
          </>}
        </div>,
        document.body,
      )}
    </>
  )
}
