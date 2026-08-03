import React from 'react'

export interface PageHeaderProps {
  actions?: React.ReactNode
  children?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  actions,
  children,
}) => {
  return (
    <div className="s4s-page-header">
      <div>
        {children}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>{actions}</div>}
    </div>
  )
}
