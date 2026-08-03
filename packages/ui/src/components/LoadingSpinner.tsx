import React from 'react'

export interface LoadingSpinnerProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Chargement...',
  size = 'md',
  centered = true,
}) => {
  const sizePx = size === 'sm' ? '1.25rem' : size === 'lg' ? '2.5rem' : '1.75rem'

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '2rem' }}>
      <div className="s4s-spinner" style={{ width: sizePx, height: sizePx }} />
      {label && <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--s4s-text-secondary)' }}>{label}</p>}
    </div>
  )

  if (centered) {
    return <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>{content}</div>
  }

  return content
}
