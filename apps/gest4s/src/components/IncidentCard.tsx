import { useState, type MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc, type RouterOutputs } from '../trpc'
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

const STATUS_VARIANTS: Record<string, 'danger' | 'warning' | 'success' | 'info' | 'purple' | 'neutral'> = {
  IN_PROGRESS: 'warning',
  OPEN_LONG_TERM: 'info',
  RESOLVED: 'success',
}

const STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'En cours',
  OPEN_LONG_TERM: 'Ouvert long-term',
  RESOLVED: 'Résolu',
}

function IncidentCard({ incident, showDelete=true }: { incident: Incident; showDelete: boolean }) {
  const utils = trpc.useUtils()
  const [isDeleting, setIsDeleting] = useState(false)

  const deleteMutation = trpc.incidents.delete.useMutation({
    onSuccess: async () => {
      await utils.incidents.list.invalidate()
      await utils.incidents.getById.invalidate({ id: incident.id })
      setIsDeleting(false)
    },
    onError: () => setIsDeleting(false),
  })

  function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()

    if (!window.confirm(`Supprimer l'incident « ${incident.title} » ?`)) {
      return
    }

    setIsDeleting(true)
    deleteMutation.mutate({ id: incident.id })
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant={STATUS_VARIANTS[incident.status] || 'neutral'} showDot>
              {STATUS_LABELS[incident.status]}
            </Badge>
            {showDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending || isDeleting}
                title="Supprimer"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--s4s-danger)',
                  cursor: deleteMutation.isPending || isDeleting ? 'wait' : 'pointer',
                  fontSize: '0.85rem',
                  padding: 0,
                }}
              >
              {deleteMutation.isPending || isDeleting ? '…' : '✕'}
            </button>
            )}
          </div>
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

        {incident.status === 'RESOLVED' && (incident.resolvedBy || incident.resolvedAt) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
              color: '#16a34a',
              fontWeight: 500,
              background: 'rgba(22, 163, 74, 0.08)',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              width: 'fit-content',
            }}
          >
            <span>✓ Résolu</span>
            {incident.resolvedBy && (
              <span>
                par <strong>{incident.resolvedBy.firstName} {incident.resolvedBy.lastName}</strong>
              </span>
            )}
            {incident.resolvedAt && (
              <span style={{ opacity: 0.9 }}>
                · {new Date(incident.resolvedAt).toLocaleString('fr-CH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--s4s-text-muted)', flexWrap: 'wrap', marginTop: '0.25rem', alignItems: 'center' }}>
          <span style={{ color: SEVERITY_COLOR[incident.severity], fontWeight: 600 }}>
            {SEVERITY_LABELS[incident.severity]}
          </span>
          {incident.location && <span>· {incident.location}</span>}
          {incident.category && <span>· {incident.category}</span>}
          {incident.contactPerson && <span>· 👤 {incident.contactPerson}</span>}
          {incident.keyNumber && <span>· 🔑 Clé n°{incident.keyNumber}</span>}
          {incident.assignedStaff && incident.assignedStaff.length > 0 && (
            <span style={{ display: 'inline-flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {incident.assignedStaff.map((st) => (
                <span
                  key={st.id}
                  style={{
                    color: 'var(--s4s-primary, #6366f1)',
                    fontWeight: 600,
                    background: 'var(--s4s-primary-light, rgba(99, 102, 241, 0.1))',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  👤 {st.firstName} {st.lastName}
                </span>
              ))}
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            {incident.reportedBy.firstName} {incident.reportedBy.lastName}
          </span>
        </div>
      </Card>
    </Link>
  )
}

export default IncidentCard
