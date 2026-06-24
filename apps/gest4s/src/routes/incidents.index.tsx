import { createFileRoute } from '@tanstack/react-router'
import Incidents from '../pages/Incidents'

export const Route = createFileRoute('/incidents/')({
  component: Incidents,
})
