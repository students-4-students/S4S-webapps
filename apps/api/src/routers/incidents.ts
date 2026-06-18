import { EventEmitter, on } from 'events'
import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const incidentEmitter = new EventEmitter()
incidentEmitter.setMaxListeners(100)

export const incidentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.incident.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
      },
    })
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      location: z.string().optional(),
      category: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
    }))
    .mutation(async ({ input, ctx }) => {
      const incident = await ctx.db.incident.create({
        data: { ...input, reportedById: ctx.user.id },
        include: { reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } } },
      })
      incidentEmitter.emit('created', incident)
      return incident
    }),

  onCreated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const [incident] of on(incidentEmitter, 'created', { signal })) {
      yield incident as { id: string }
    }
  }),
})
