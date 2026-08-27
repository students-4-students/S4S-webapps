import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import IncidentCard from '../components/IncidentCard'
import CreateIncidentModal from '../components/CreateIncidentModal'
import StaffCombobox from '../components/StaffCombobox'
import { SearchInput, PageHeader, Select, Button, EmptyState, LoadingSpinner, matchesSearch } from '@s4s/ui'
import { useIncidentRealtimeUpdates } from '../hooks/useIncidentRealtimeUpdates'
import '../../styles/dashboard.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'OPEN_LONG_TERM', label: 'Ouvert long-term' },
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
  const [filters, setFilters] = useState({
    location: '',
    status: 'IN_PROGRESS',
    severity: '',
    category: '',
    staffId: '',
  })

  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery(undefined, {
    refetchInterval: 1000,
    refetchOnWindowFocus: "always",
  })

  useIncidentRealtimeUpdates()

  const filtered = incidents.filter((inc) => {
    if (filters.status && inc.status !== filters.status) return false
    if (filters.severity && inc.severity !== filters.severity) return false
    if (filters.category && inc.category !== filters.category) return false
    if (filters.staffId && !inc.assignedStaff?.some((st) => st.id === filters.staffId)) return false

    if (filters.location && !matchesSearch(inc.location, filters.location)) {
      return false
    }

    return true
  })

  const hasActiveFilters = Boolean(
    filters.location ||
    filters.status ||
    filters.severity ||
    filters.category ||
    filters.staffId
  )

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
          <div style={{ width: '160px' }}>
            <SearchInput
              icon="📍"
              placeholder="Lieu..."
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
              onClear={() => setFilters((f) => ({ ...f, location: '' }))}
            />
          </div>

          <div style={{ width: '170px' }}>
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

          <div style={{ width: '170px' }}>
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

          <div style={{ width: '190px' }}>
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

          <div style={{ width: '220px' }}>
            <StaffCombobox
              placeholder="Filtrer par staff..."
              value={filters.staffId}
              onChange={(id) => setFilters((f) => ({ ...f, staffId: id }))}
              allowUnassigned={true}
              style={{ marginBottom: 0 }}
            />
          </div>

          {hasActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setFilters({ location: '', status: '', severity: '', category: '', staffId: '' })}
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
              onAction={hasActiveFilters ? () => setFilters({ location: '', status: '', severity: '', category: '', staffId: '' }) : undefined}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {filtered.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} showDelete={false} />
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
