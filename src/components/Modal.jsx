import React from 'react'

export function ModalOverlay({ onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(14,23,38,0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'rise 0.2s ease both',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 560,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 30px 80px -20px rgba(14,23,38,0.3)',
        position: 'relative',
      }}>
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div style={{ fontFamily: 'Onest', fontWeight: 700, fontSize: 18, color: '#0E1726' }}>{title}</div>
      <button
        onClick={onClose}
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
