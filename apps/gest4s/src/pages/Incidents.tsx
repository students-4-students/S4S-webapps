import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import IncidentCard from '../components/IncidentCard'
import CreateIncidentModal from '../components/CreateIncidentModal'
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
  const utils = trpc.useUtils()
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({ status: '', severity: '', category: '' })

  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery()

  trpc.incidents.onCreated.useSubscription(undefined, {
    onData: () => utils.incidents.list.invalidate(),
  })

  const filtered = incidents.filter((inc) =>
    (!filters.status || inc.status === filters.status) &&
    (!filters.severity || inc.severity === filters.severity) &&
    (!filters.category || inc.category === filters.category)
  )

  return (
    <div className='dashboard' style={{ position: 'relative' }}>
      <div className='col' style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0, flex: 1 }}>Incidents</h1>
          <button className='btn-primary' onClick={() => setShowModal(true)}>+ Nouveau</button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filters.severity} onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}>
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value=''>Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filters.status || filters.severity || filters.category) && (
            <button style={{ marginTop: 0 }} onClick={() => setFilters({ status: '', severity: '', category: '' })}>
              Réinitialiser
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {isLoading && <p>Chargement…</p>}
          {!isLoading && filtered.length === 0 && <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>Aucun incident.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {filtered.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        </div>

      </div>

      <Link to='/' style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', color: 'var(--primary-purple)', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
        ← Dashboard
      </Link>

      {showModal && <CreateIncidentModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

export default Incidents
