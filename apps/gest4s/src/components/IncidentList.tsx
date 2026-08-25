import { trpc } from '../trpc'
import IncidentCard from './IncidentCard'
import { useIncidentRealtimeUpdates } from '../hooks/useIncidentRealtimeUpdates'

interface Props {
  onNew: () => void
}

function IncidentList({ onNew }: Props) {
  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery(undefined, {
    refetchInterval: 1000,
    refetchOnWindowFocus: "always",
  })

  useIncidentRealtimeUpdates()

  const visibleIncidents = incidents.filter((incident) => incident.status === 'IN_PROGRESS')

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Incidents</h1>
        <button className="btn-primary" onClick={onNew}>+ Nouveau</button>
      </div>

      {isLoading && <p>Chargement…</p>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.2rem' }}>
        {visibleIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} showDelete={false} />
        ))}
      </div>
    </div>
  )
}

export default IncidentList
