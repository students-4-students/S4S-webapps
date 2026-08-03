import React from 'react'
import { Button } from './Button'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📭',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div className={`s4s-empty-state ${className}`.trim()}>
      <div className="s4s-empty-icon">{icon}</div>
      <h3 className="s4s-empty-title">{title}</h3>
      {description && <p className="s4s-empty-desc">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
