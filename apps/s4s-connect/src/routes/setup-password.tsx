import { createFileRoute } from '@tanstack/react-router'
import SetupPassword from '../pages/SetupPassword'

export const Route = createFileRoute('/setup-password')({
  component: SetupPassword,
})
