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

  return (
    <div className='col' style={{ width: '25%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Incidents</h1>
        <button className='btn-primary' onClick={onNew}>+ Nouveau</button>
      </div>

      {isLoading && <p>Chargement…</p>}
      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} />
      ))}
    </div>
  )
}

export default IncidentList
