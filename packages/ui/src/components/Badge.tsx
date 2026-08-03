import React from 'react'

export interface BadgeProps {
  variant?: 'neutral' | 'purple' | 'success' | 'warning' | 'danger' | 'info'
  showDot?: boolean
  children: React.ReactNode
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  showDot = false,
  children,
  className = '',
}) => {
  return (
    <span className={`s4s-badge s4s-badge--${variant} ${className}`.trim()}>
      {showDot && <span className="s4s-badge__dot" />}
      {children}
    </span>
  )
}
