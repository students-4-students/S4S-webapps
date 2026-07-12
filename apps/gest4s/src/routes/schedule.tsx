import { createFileRoute } from '@tanstack/react-router'
import Schedule from '../pages/Schedule'


export const Route = createFileRoute('/schedule')({
  component: Schedule,
})
