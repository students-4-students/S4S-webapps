import { router } from '../trpc/trpc'
import { authRouter } from './auth'
import { incidentsRouter } from './incidents'
import { staffsRouter } from './staffs'
import { schedulesRouter } from './schedules'
import { studentsRouter } from './students'
import { workshopsRouter } from './workshops'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
  staffs: staffsRouter,
  schedules: schedulesRouter,
  students: studentsRouter,
  workshops: workshopsRouter,
})

export type AppRouter = typeof appRouter