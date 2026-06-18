import { router } from '../trpc/trpc'
import { authRouter } from './auth'
import { incidentsRouter } from './incidents'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
})

export type AppRouter = typeof appRouter