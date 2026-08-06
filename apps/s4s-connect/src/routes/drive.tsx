import { createFileRoute } from '@tanstack/react-router'
import Drive from '../pages/Drive'

export const Route = createFileRoute('/drive')({
  component: Drive,
})
