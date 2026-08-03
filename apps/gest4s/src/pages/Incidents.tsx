import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import IncidentCard from '../components/IncidentCard'
import CreateIncidentModal from '../components/CreateIncidentModal'
import { PageHeader, Select, Button, EmptyState, LoadingSpinner } from '@s4s/ui'
import { useIncidentRealtimeUpdates } from '../hooks/useIncidentRealtimeUpdates'
import '../../styles/dashboard.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'OPEN', label: 'Ouvert' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'RESOLVED', label: 'Résolu' },
]

const SEVERITY_OPTIONS = [
  { value: '', label: 'Toutes les sévérités' },
  { value: 'LOW', label: 'Faible' },
  { value: 'MEDIUM', label: 'Moyen' },
  { value: 'HIGH', label: 'Élevé' },
]

const CATEGORIES = ['Matériel', 'Problèmes techniques', 'Logistique', 'Catering', 'RH', 'Exercices', 'Cours']

function Incidents() {
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({ status: '', severity: '', category: '' })

  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery(undefined, {
    refetchInterval: 1000,
    refetchOnWindowFocus: "always",
  })

  useIncidentRealtimeUpdates()

  const filtered = incidents.filter(
    (inc) =>
      (!filters.status || inc.status === filters.status) &&
      (!filters.severity || inc.severity === filters.severity) &&
      (!filters.category || inc.category === filters.category)
  )

  const hasActiveFilters = Boolean(filters.status || filters.severity || filters.category)

  return (
    <div className="dashboard" style={{ position: 'relative' }}>
      <div className="col" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        <PageHeader
          actions={
            <Button variant="primary" onClick={() => setShowModal(true)}>
              + Nouveau
            </Button>
          }
        />

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ width: '180px' }}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: '180px' }}>
            <Select
              value={filters.severity}
              onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: '200px' }}>
            <Select
              value={filters.category}
              onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Toutes les catégories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>

          {hasActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters({ status: '', severity: '', category: '' })}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && <LoadingSpinner label="Chargement des incidents..." />}
          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon="🚨"
              title="Aucun incident trouvé"
              description={hasActiveFilters ? "Essayez d'ajuster vos filtres de recherche." : "Aucun incident n'a été signalé pour le moment."}
              actionLabel={hasActiveFilters ? "Réinitialiser les filtres" : undefined}
              onAction={hasActiveFilters ? () => setFilters({ status: '', severity: '', category: '' }) : undefined}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {filtered.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        </div>
      </div>

      <Link
        to="/"
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '1.5rem',
          color: 'var(--s4s-primary)',
          fontWeight: 600,
          textDecoration: 'none',
          fontSize: '0.9rem',
        }}
      >
        ← Dashboard
      </Link>

      {showModal && <CreateIncidentModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default Incidents
