import { router } from '../trpc/trpc'
import { authRouter } from './auth'
import { incidentsRouter } from './incidents'
import { staffsRouter } from './staffs'
import { schedulesRouter } from './schedules'
import { studentsRouter } from './students'
import { workshopsRouter } from './workshops'
import { tasksRouter } from './tasks'
import { shiftsRouter } from './shifts'
import { scanRouter } from './scan'
import { driveRouter } from './drive'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
  staffs: staffsRouter,
  schedules: schedulesRouter,
  students: studentsRouter,
  workshops: workshopsRouter,
  tasks: tasksRouter,
  shifts: shiftsRouter,
  scan: scanRouter,
  drive: driveRouter,
})

export type AppRouter = typeof appRouter