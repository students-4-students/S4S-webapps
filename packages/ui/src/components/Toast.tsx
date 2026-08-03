import React from 'react'

export interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose?: () => void
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  return (
    <div
      className="toast-notification"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 2000,
        backgroundColor: type === 'error' ? 'var(--s4s-danger)' : type === 'success' ? 'var(--s4s-success)' : 'var(--s4s-primary)',
        color: '#ffffff',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--s4s-radius-lg)',
        boxShadow: 'var(--s4s-shadow-lg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        animation: 's4s-fade-in 200ms ease-out',
      }}
    >
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.8 }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
