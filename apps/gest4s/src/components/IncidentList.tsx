import { useState } from 'react'
import { trpc } from '../trpc'
import IncidentCard from './IncidentCard'
import { useIncidentRealtimeUpdates } from '../hooks/useIncidentRealtimeUpdates'
import { SearchInput, matchesSearch } from '@s4s/ui'

interface Props {
  onNew: () => void
}

function IncidentList({ onNew }: Props) {
  const [search, setSearch] = useState('')
  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery(undefined, {
    refetchInterval: 1000,
    refetchOnWindowFocus: "always",
  })

  useIncidentRealtimeUpdates()

  const visibleIncidents = incidents
    .filter((incident) => incident.status === 'IN_PROGRESS' || incident.status === 'OPEN_LONG_TERM')
    .filter((incident) => {
      if (!search.trim()) return true
      const searchTarget = [
        incident.title,
        incident.description,
        incident.location || '',
        incident.category || '',
        incident.contactPerson || '',
        incident.reportedBy ? `${incident.reportedBy.firstName} ${incident.reportedBy.lastName}` : '',
        ...(incident.assignedStaff || []).map((st) => `${st.firstName} ${st.lastName}`),
      ].join(' ')
      return matchesSearch(searchTarget, search) || matchesSearch(incident.location, search)
    })

  return (
    <div
      className="col"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Incidents</h1>
        <button className="btn-primary" onClick={onNew}>+ Nouveau</button>
      </div>

      <div style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
        <SearchInput
          placeholder="Rechercher (titre, lieu...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />
      </div>

      {isLoading && <p>Chargement…</p>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.2rem' }}>
        {!isLoading && visibleIncidents.length === 0 && (
          <p style={{ fontSize: '0.875rem', color: 'var(--s4s-text-secondary, #888)', textAlign: 'center', margin: '1rem 0' }}>
            {search ? 'Aucun incident correspondant' : 'Aucun incident en cours'}
          </p>
        )}
        {visibleIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} showDelete={false} />
        ))}
      </div>
    </div>
  )
}

export default IncidentList
