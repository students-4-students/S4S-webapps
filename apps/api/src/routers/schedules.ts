import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const schedulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.scheduleSlot.findMany({
      orderBy: { startTime: 'asc' },
      include: {
        section: true,
        speaker: { select: { id: true, firstName: true, lastName: true } },
        assistant: { select: { id: true, firstName: true, lastName: true } },
        rc: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }),

  listBySection: protectedProcedure
    .input(z.object({ sectionId: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.scheduleSlot.findMany({
        where: { sectionId: input.sectionId },
        orderBy: { startTime: 'asc' },
        include: {
          section: true,
          speaker: { select: { id: true, firstName: true, lastName: true } },
          assistant: { select: { id: true, firstName: true, lastName: true } },
          rc: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }),

  listByLocation: protectedProcedure
    .input(z.object({ location: z.string() }))
    .query(async ({ input, ctx }) => {
      return ctx.db.scheduleSlot.findMany({
        where: { location: input.location },
        orderBy: { startTime: 'asc' },
        include: {
          section: true,
          speaker: { select: { id: true, firstName: true, lastName: true } },
          assistant: { select: { id: true, firstName: true, lastName: true } },
          rc: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional().nullable(),
      type: z.enum(['LECTURE', 'EXERCISE', 'WORKSHOP', 'ACTIVITY', 'FREE']),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      location: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.scheduleSlot.create({
        data: input,
        include: {
          section: true,
          speaker: { select: { id: true, firstName: true, lastName: true } },
          assistant: { select: { id: true, firstName: true, lastName: true } },
          rc: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      type: z.enum(['LECTURE', 'EXERCISE', 'WORKSHOP', 'ACTIVITY', 'FREE']).optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      location: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.scheduleSlot.update({
        where: { id },
        data,
        include: {
          section: true,
          speaker: { select: { id: true, firstName: true, lastName: true } },
          assistant: { select: { id: true, firstName: true, lastName: true } },
          rc: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.scheduleSlot.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),

  checkConflicts: protectedProcedure
    .input(z.object({
      id: z.string().optional(),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      location: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
    }))
    .query(async ({ input, ctx }) => {
      const conflicts: any[] = []

      // Check Location Overlaps
      if (input.location) {
        const locationConflicts = await ctx.db.scheduleSlot.findMany({
          where: {
            id: input.id ? { not: input.id } : undefined,
            location: input.location,
            startTime: { lt: input.endTime },
            endTime: { gt: input.startTime },
          },
        })
        for (const slot of locationConflicts) {
          conflicts.push({
            type: 'LOCATION',
            message: `La salle '${input.location}' est déjà occupée par le cours '${slot.title}' sur ce créneau.`,
          })
        }
      }

      // Check Section Overlaps
      if (input.sectionId) {
        const sectionConflicts = await ctx.db.scheduleSlot.findMany({
          where: {
            id: input.id ? { not: input.id } : undefined,
            sectionId: input.sectionId,
            startTime: { lt: input.endTime },
            endTime: { gt: input.startTime },
          },
        })
        for (const slot of sectionConflicts) {
          conflicts.push({
            type: 'SECTION',
            message: `La section est déjà occupée par le cours '${slot.title}' sur ce créneau.`,
          })
        }
      }

      return conflicts
    }),
})
