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
        resolvedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
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
      contactPerson: z.string().optional(),
      keyNumber: z.string().optional(),
      assignedStaffIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { assignedStaffIds, ...rest } = input
      const incident = await ctx.db.incident.create({
        data: {
          ...rest,
          reportedById: ctx.user.id,
          ...(assignedStaffIds && assignedStaffIds.length > 0 ? {
            assignedStaff: { connect: assignedStaffIds.map((id) => ({ id })) },
          } : {}),
        },
        include: {
          reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          resolvedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
      incidentEmitter.emit('created', incident)
      return incident
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.incident.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          resolvedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      location: z.string().optional(),
      category: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
      status: z.enum(['IN_PROGRESS', 'OPEN_LONG_TERM', 'RESOLVED']).optional(),
      contactPerson: z.string().nullable().optional(),
      keyNumber: z.string().nullable().optional(),
      assignedStaffIds: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, assignedStaffIds, ...data } = input

      let resolvedUpdate: { resolvedAt?: Date | null; resolvedById?: string | null } = {}
      if (data.status !== undefined) {
        if (data.status === 'RESOLVED') {
          const existing = await ctx.db.incident.findUnique({
            where: { id },
            select: { status: true, resolvedAt: true, resolvedById: true },
          })
          if (existing?.status !== 'RESOLVED' || !existing?.resolvedAt) {
            resolvedUpdate = {
              resolvedAt: new Date(),
              resolvedById: ctx.user.id,
            }
          }
        } else {
          resolvedUpdate = {
            resolvedAt: null,
            resolvedById: null,
          }
        }
      }

      const incident = await ctx.db.incident.update({
        where: { id },
        data: {
          ...data,
          ...resolvedUpdate,
          ...(assignedStaffIds !== undefined ? {
            assignedStaff: { set: assignedStaffIds.map((sid) => ({ id: sid })) },
          } : {}),
        },
        include: {
          reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          resolvedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
      incidentEmitter.emit('updated', incident)
      return incident
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const incident = await ctx.db.incident.delete({
        where: { id: input.id },
        include: {
          reportedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          resolvedBy: { select: { firstName: true, lastName: true, telegramUsername: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
      incidentEmitter.emit('deleted', incident)
      return incident
    }),

  onCreated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const [incident] of on(incidentEmitter, 'created', { signal })) {
      yield incident as { id: string }
    }
  }),

  onUpdated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const [incident] of on(incidentEmitter, 'updated', { signal })) {
      yield incident as { id: string }
    }
  }),

  onDeleted: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const [incident] of on(incidentEmitter, 'deleted', { signal })) {
      yield incident as { id: string }
    }
  }),
})
