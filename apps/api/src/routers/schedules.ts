import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

async function resolveSectionId(sectionNameOrId: string | null | undefined, db: any): Promise<string | null> {
  if (!sectionNameOrId) return null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(sectionNameOrId)) {
    const existing = await db.section.findUnique({ where: { id: sectionNameOrId } })
    if (existing) return existing.id
  }
  const section = await db.section.findFirst({
    where: { name: { equals: sectionNameOrId, mode: 'insensitive' } }
  })
  if (section) {
    return section.id
  }
  const newSection = await db.section.create({
    data: { name: sectionNameOrId }
  })
  return newSection.id
}

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
      const resolvedId = await resolveSectionId(input.sectionId, ctx.db)
      return ctx.db.scheduleSlot.findMany({
        where: { sectionId: resolvedId || input.sectionId },
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
      type: z.enum(['LECTURE', 'EXERCISE', 'WORKSHOP', 'ACTIVITY', 'FREE', 'SPECIAL', 'MEAL']),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
      location: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      targetGroup: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const resolvedSectionId = await resolveSectionId(input.sectionId, ctx.db)
      return ctx.db.scheduleSlot.create({
        data: {
          ...input,
          sectionId: resolvedSectionId,
        },
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
      type: z.enum(['LECTURE', 'EXERCISE', 'WORKSHOP', 'ACTIVITY', 'FREE', 'SPECIAL', 'MEAL']).optional(),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      location: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      targetGroup: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      if ('sectionId' in data) {
        data.sectionId = await resolveSectionId(data.sectionId, ctx.db)
      }
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
        const inputRooms = input.location.split(/[,;/]+/).map((r) => r.trim().toUpperCase()).filter((r) => r.length > 0)
        if (inputRooms.length > 0) {
          const potentialConflicts = await ctx.db.scheduleSlot.findMany({
            where: {
              id: input.id ? { not: input.id } : undefined,
              startTime: { lt: input.endTime },
              endTime: { gt: input.startTime },
              location: { not: null },
            },
          })
          for (const slot of potentialConflicts) {
            const slotRooms = slot.location!.split(/[,;/]+/).map((r) => r.trim().toUpperCase()).filter((r) => r.length > 0)
            const overlap = inputRooms.some(r => slotRooms.includes(r))
            if (overlap) {
              conflicts.push({
                type: 'LOCATION',
                message: `La salle '${slot.location}' est déjà occupée par le cours '${slot.title}' sur ce créneau.`,
              })
            }
          }
        }
      }

      // Check Section Overlaps
      if (input.sectionId) {
        const resolvedSectionId = await resolveSectionId(input.sectionId, ctx.db)
        if (resolvedSectionId) {
          const sectionConflicts = await ctx.db.scheduleSlot.findMany({
            where: {
              id: input.id ? { not: input.id } : undefined,
              sectionId: resolvedSectionId,
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
      }

      return conflicts
    }),
})
