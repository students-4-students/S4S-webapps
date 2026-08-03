import React from 'react'
import { Card } from './Card'

export interface StatDetail {
  label: string
  value: number | string
}

export interface StatCardProps {
  title: string
  value: number | string
  details?: StatDetail[]
  icon?: React.ReactNode
  badge?: React.ReactNode
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  details,
  icon,
  badge,
}) => {
  return (
    <Card hoverable className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h3 className="stat-title" style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--s4s-text-secondary)' }}>
          {title}
        </h3>
        {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: details?.length ? '0.75rem' : '0' }}>
        <span className="stat-value" style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--s4s-text-primary)' }}>
          {value}
        </span>
        {badge}
      </div>

      {details && details.length > 0 && (
        <div className="stat-details" style={{ display: 'flex', gap: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--s4s-border)' }}>
          {details.map((item, index) => (
            <div key={index} className="stat-detail">
              <p className="stat-label" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--s4s-text-muted)' }}>
                {item.label}
              </p>
              <p className="stat-number" style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--s4s-text-primary)' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
