import { Link } from '@tanstack/react-router'
import type { RouterOutputs } from '../trpc'

type Incident = RouterOutputs['incidents']['list'][number]

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#27ae60',
  MEDIUM: '#f39c12',
  HIGH: '#e74c3c',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Élevé',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert',
  IN_PROGRESS: 'En cours',
  RESOLVED: 'Résolu',
}

const STATUS_BG: Record<string, string> = {
  OPEN: '#fdecea',
  IN_PROGRESS: '#fff8e1',
  RESOLVED: '#e8f5e9',
}

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#c0392b',
  IN_PROGRESS: '#e67e22',
  RESOLVED: '#27ae60',
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link
      to='/incidents/$incidentId'
      params={{ incidentId: incident.id }}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div style={{
        borderLeft: `4px solid ${SEVERITY_COLOR[incident.severity] ?? '#ccc'}`,
        background: 'white',
        borderRadius: '0.5rem',
        padding: '0.6rem 0.75rem',
        marginBottom: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <strong style={{ fontSize: '0.95rem' }}>{incident.title}</strong>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: '0.15rem 0.5rem',
            borderRadius: '1rem',
            background: STATUS_BG[incident.status],
            color: STATUS_COLOR[incident.status],
            whiteSpace: 'nowrap',
          }}>
            {STATUS_LABELS[incident.status]}
          </span>
        </div>

        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: '#444',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {incident.description}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: '#777', flexWrap: 'wrap' }}>
          <span style={{ color: SEVERITY_COLOR[incident.severity], fontWeight: 600 }}>
            {SEVERITY_LABELS[incident.severity]}
          </span>
          {incident.location && <span>· {incident.location}</span>}
          {incident.category && <span>· {incident.category}</span>}
          <span style={{ marginLeft: 'auto' }}>
            {incident.reportedBy.firstName} {incident.reportedBy.lastName}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default IncidentCard
