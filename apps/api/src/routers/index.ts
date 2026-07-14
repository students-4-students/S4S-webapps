import { router } from '../trpc/trpc'
import { authRouter } from './auth'
import { incidentsRouter } from './incidents'
import { staffsRouter } from './staffs'
import { schedulesRouter } from './schedules'
import { studentsRouter } from './students'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
  staffs: staffsRouter,
  schedules: schedulesRouter,
  students: studentsRouter,
})

export type AppRouter = typeof appRouter