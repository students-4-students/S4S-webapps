import { createFileRoute } from '@tanstack/react-router'
import Staffs from '../pages/Staffs'


export const Route = createFileRoute('/staffs')({
  component: Staffs,
})
