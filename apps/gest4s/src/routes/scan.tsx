import { createFileRoute } from '@tanstack/react-router'
import Scan from '../pages/Scan'

export const Route = createFileRoute('/scan')({
  component: Scan,
})
