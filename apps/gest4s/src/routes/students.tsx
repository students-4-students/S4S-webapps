import { createFileRoute } from '@tanstack/react-router'
import Students from '../pages/Students'

export const Route = createFileRoute('/students')({
  component: Students,
})
