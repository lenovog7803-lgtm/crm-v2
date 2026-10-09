import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useIsMobile } from '../hooks/useIsMobile'
import { spring, project, rubberband, velocityTracker, prefersReducedMotion } from '../motion'

// Модалка. На телефоне — шторка снизу в духе iOS: выезжает и уходит одним путём (вниз),
// тянется за пальцем 1:1 за ручку или заголовок, закрывается броском (позиция + скорость),
// иначе возвращается пружиной с той же скоростью. На компьютере — растворение при закрытии.
const SheetCtx = createContext(null)
const SCRIM = 0.4

export const useSheet = () => useContext(SheetCtx)

export function ModalOverlay({ onClose, children, panelStyle, bodyStyle }) {
  const isMobile = useIsMobile()
  const overlayRef = useRef(null)
  const scrimRef = useRef(null)
  const panelRef = useRef(null)
  const y = useRef(0)
  const anim = useRef(null)
  const drag = useRef(null)
  const vel = useRef(velocityTracker())
  const done = useRef(false)
  const [closing, setClosing] = useState(false)

  const height = () => panelRef.current?.offsetHeight || 600
  const setY = (v) => {
    y.current = v
    // только transform и opacity — их видеокарта двигает без перерисовки страницы
    if (panelRef.current) panelRef.current.style.transform = `translate3d(0, ${v}px, 0)`
    // затемнение уходит вместе со шторкой — видно, сколько осталось до закрытия
    const progress = Math.min(1, Math.max(0, v / height()))
    if (scrimRef.current) scrimRef.current.style.opacity = (1 - progress).toFixed(3)
  }
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const finish = () => {
    if (done.current) return
    done.current = true
    onClose()
    // «Вы уверены? Изменения не сохранятся» → «Отмена»: окно осталось — возвращаем его на место
    setTimeout(() => {
      if (!mounted.current) return
      done.current = false
      setClosing(false)
      if (isMobile) anim.current = spring({ from: y.current, to: 0, damping: 1, response: 0.35, onUpdate: setY })
    }, 0)
  }

  // шторка выезжает снизу — тем же путём потом и уйдёт
  useLayoutEffect(() => {
    if (!isMobile || !panelRef.current) return
    setY(height())
    anim.current = spring({ from: height(), to: 0, damping: 1, response: 0.35, onUpdate: setY })
    return () => anim.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile])

  const requestClose = (velocity = 0) => {
    if (done.current || closing) return
    if (isMobile) {
      anim.current?.()
      anim.current = spring({ from: y.current, to: height(), velocity, damping: 1, response: 0.3, onUpdate: setY, onDone: finish })
    } else {
      setClosing(true)
      setTimeout(finish, prefersReducedMotion() ? 0 : 150)
    }
  }
  useEscapeKey(() => requestClose())

  const dragHandlers = isMobile ? {
    onPointerDown: (e) => {
      if (e.button !== 0 || e.target.closest('button, a, input, select, textarea')) return
      anim.current?.()  // перехватываем шторку прямо в движении
      drag.current = { startY: e.clientY, base: y.current }
      vel.current.reset()
      vel.current.add(y.current)
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    onPointerMove: (e) => {
      if (!drag.current) return
      const raw = drag.current.base + (e.clientY - drag.current.startY)
      vel.current.add(raw)
      setY(raw < 0 ? rubberband(raw, height()) : raw)  // вверх — резинка, вниз — 1:1
    },
    onPointerUp: () => {
      if (!drag.current) return
      drag.current = null
      const v = vel.current.velocity()
      if (y.current + project(v) > height() * 0.4 && v > -150) {
        requestClose(v)
      } else {
        // брошено вверх/недотянуто — возврат; лёгкий отскок, раз был бросок
        anim.current = spring({ from: y.current, to: 0, velocity: v, damping: Math.abs(v) > 300 ? 0.85 : 1, response: 0.3, onUpdate: setY })
      }
    },
    onPointerCancel: () => {
      if (!drag.current) return
      drag.current = null
      anim.current = spring({ from: y.current, to: 0, damping: 1, response: 0.3, onUpdate: setY })
    },
    style: { touchAction: 'none', cursor: 'grab' },
  } : null

  return (
    <SheetCtx.Provider value={{ requestClose, dragHandlers }}>
      <div
        ref={overlayRef}
        className="modal-overlay"
        style={isMobile ? {
          // телефон: без размытия (тяжело для GPU на каждом кадре) и без прокрутки подложки,
          // пока шторка за экраном — иначе слой «дёргается» при выезде
          position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden', display: 'grid', padding: 0,
        } : {
          position: 'fixed', inset: 0,
          background: `rgba(14,23,38,${SCRIM})`,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 1000,
          overflowY: 'auto',
          display: 'grid',
          padding: 24,
          animation: closing ? 'fadeOut 0.15s ease-in both' : 'pageIn 0.2s ease-out',
        }}
      >
        {isMobile && (
          <div ref={scrimRef} onClick={() => requestClose()}
            style={{ position: 'absolute', inset: 0, background: `rgba(14,23,38,${SCRIM})`, opacity: 0, willChange: 'opacity' }} />
        )}
        <div ref={panelRef} className="modal-panel" style={{
          margin: 'auto',
          background: isMobile ? '#FFFFFF' : 'rgba(255,255,255,0.97)',
          backdropFilter: isMobile ? 'none' : 'blur(24px) saturate(180%)',
          // до первого кадра шторка уже за экраном — без вспышки в конечном положении
          transform: isMobile ? 'translate3d(0, 100%, 0)' : undefined,
          overflowY: isMobile ? 'auto' : undefined,
          overscrollBehavior: 'contain',
          borderRadius: 24,
          width: '100%',
          maxWidth: 560,
          boxShadow: '0 30px 80px -20px rgba(14,23,38,0.3)',
          position: 'relative',
          animation: isMobile ? 'none' : closing ? 'modalOut 0.15s ease-in both' : 'modalIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
          willChange: isMobile ? 'transform' : undefined,
          ...panelStyle,
        }}>
          {isMobile && (
            <div {...dragHandlers} style={{ ...dragHandlers.style, position: 'absolute', top: 0, left: 0, right: 0, height: 28,
              display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
              <div style={{ width: 38, height: 5, borderRadius: 99, background: 'rgba(14,23,38,0.18)' }} />
            </div>
          )}
          <div style={{ padding: 32, ...bodyStyle }}>
            {children}
          </div>
        </div>
      </div>
    </SheetCtx.Provider>
  )
}

export function ModalHeader({ title, onClose }) {
  const sheet = useContext(SheetCtx)
  // заголовок шторки — тоже «ручка»: тянуть можно за всю верхнюю полосу
  const drag = sheet?.dragHandlers || {}
  return (
    <div {...drag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, ...(drag.style || {}) }}>
      <div style={{ fontFamily: 'var(--font-sys)', fontWeight: 700, fontSize: 18, color: '#0E1726' }}>{title}</div>
      <button
        onClick={() => (sheet ? sheet.requestClose() : onClose?.())}
        aria-label="Закрыть"
        style={{
          width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'rgba(14,23,38,0.07)', color: '#5A6573',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
