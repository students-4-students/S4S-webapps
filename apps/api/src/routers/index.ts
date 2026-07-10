import { router } from '../trpc/trpc'
import { authRouter } from './auth'
import { incidentsRouter } from './incidents'
import { staffsRouter } from './staffs'
import { schedulesRouter } from './schedules'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
  staffs: staffsRouter,
  schedules: schedulesRouter,
})

export type AppRouter = typeof appRouter