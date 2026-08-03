import { createFileRoute } from '@tanstack/react-router'
import Operations from '../pages/Operations'

export const Route = createFileRoute('/operations')({
  component: Operations,
})
