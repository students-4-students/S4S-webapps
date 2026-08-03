import { Link } from '@tanstack/react-router'
import type { RouterOutputs } from '../trpc'
import { Card, Badge } from '@s4s/ui'

type Incident = RouterOutputs['incidents']['list'][number]

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
}

const STATUS_VARIANTS: Record<string, 'danger' | 'warning' | 'success'> = {
  OPEN: 'danger',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link
      to="/incidents/$incidentId"
      params={{ incidentId: incident.id }}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <Card
        hoverable
        style={{
          borderLeft: `4px solid ${SEVERITY_COLOR[incident.severity] ?? '#ccc'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          padding: '0.75rem 1rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--s4s-text-primary)' }}>{incident.title}</strong>
          <Badge variant={STATUS_VARIANTS[incident.status] || 'neutral'} showDot>
            {STATUS_LABELS[incident.status]}
          </Badge>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--s4s-text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {incident.description}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--s4s-text-muted)', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <span style={{ color: SEVERITY_COLOR[incident.severity], fontWeight: 600 }}>
            {SEVERITY_LABELS[incident.severity]}
          </span>
          {incident.location && <span>· {incident.location}</span>}
          {incident.category && <span>· {incident.category}</span>}
          <span style={{ marginLeft: 'auto' }}>
            {incident.reportedBy.firstName} {incident.reportedBy.lastName}
          </span>
        </div>
      </Card>
    </Link>
  )
}

export default IncidentCard
