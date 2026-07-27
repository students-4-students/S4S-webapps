import { createFileRoute } from '@tanstack/react-router'
import Workshops from '../pages/Workshops'

export const Route = createFileRoute('/workshops')({
  component: Workshops,
})
