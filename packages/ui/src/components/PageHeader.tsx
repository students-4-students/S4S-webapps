import React from 'react'

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  children,
}) => {
  return (
    <div className="s4s-page-header">
      <div>
        <h1 className="s4s-page-title">{title}</h1>
        {subtitle && <p className="s4s-page-subtitle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>{actions}</div>}
    </div>
  )
}
