import React from 'react'
import type { RouterOutputs } from '../trpc'

type Incident = RouterOutputs['incidents']['list'][number]

const SEVERITY_BORDER: Record<string, string> = {
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

function IncidentCard({ incident }: { incident: Incident }) {
    return (
        <div style={{
            borderLeft: `4px solid ${SEVERITY_BORDER[incident.severity] ?? '#ccc'}`,
            background: 'white',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.75rem',
            marginBottom: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
        }}>
            <strong style={{ fontSize: '1rem' }}>{incident.title}</strong>
            <span style={{ fontSize: '0.9rem', color: '#555' }}>
                {SEVERITY_LABELS[incident.severity]} · {STATUS_LABELS[incident.status]}
                {incident.location && ` · ${incident.location}`}
                {incident.category && ` · ${incident.category}`}
            </span>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>
                {incident.reportedBy.firstName} {incident.reportedBy.lastName}
                {incident.reportedBy.telegramUsername && ` · ${incident.reportedBy.telegramUsername}`}
            </span>
        </div>
    )
}

export default IncidentCard
