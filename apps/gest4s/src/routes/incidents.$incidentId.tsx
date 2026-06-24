import { createFileRoute } from '@tanstack/react-router'
import IncidentDetail from '../pages/IncidentDetail'

export const Route = createFileRoute('/incidents/$incidentId')({
  component: IncidentDetail,
})
