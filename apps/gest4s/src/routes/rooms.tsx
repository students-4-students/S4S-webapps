import { createFileRoute } from '@tanstack/react-router'
import Rooms from '../pages/Rooms'

export const Route = createFileRoute('/rooms')({
  component: Rooms,
})
