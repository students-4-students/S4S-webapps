import React, { useEffect } from 'react'

export interface ModalProps {
  isOpen?: boolean
  onClose: () => void
  title?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  footer?: React.ReactNode
  closeOnBackdrop?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  isOpen = true,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  closeOnBackdrop = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="s4s-modal-backdrop"
      onClick={() => {
        if (closeOnBackdrop) onClose()
      }}
    >
      <div
        className={`s4s-modal-container s4s-modal--${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="s4s-modal-header">
            <h2 className="s4s-modal-title">{title}</h2>
            <button className="s4s-modal-close-btn" onClick={onClose} aria-label="Fermer">
              ✕
            </button>
          </div>
        )}
        <div className="s4s-modal-body">{children}</div>
        {footer && <div className="s4s-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
