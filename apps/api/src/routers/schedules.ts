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

async function resolveStaffId(staffIdentifier: any, db: any): Promise<string | null> {
  if (!staffIdentifier) return null
  if (typeof staffIdentifier === 'object') {
    if (staffIdentifier.id) return resolveStaffId(staffIdentifier.id, db)
    if (staffIdentifier.firstName || staffIdentifier.lastName) {
      const name = `${staffIdentifier.firstName || ''} ${staffIdentifier.lastName || ''}`.trim()
      return resolveStaffId(name, db)
    }
    return null
  }
  const str = String(staffIdentifier).trim()
  if (!str) return null
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(str)) {
    const existing = await db.staffMember.findUnique({ where: { id: str } })
    if (existing) return existing.id
  }
  const clean = str.toLowerCase()
  const allStaffs = await db.staffMember.findMany()
  const matched = allStaffs.find(
    (s: any) =>
      `${s.firstName} ${s.lastName}`.toLowerCase() === clean ||
      `${s.lastName} ${s.firstName}`.toLowerCase() === clean ||
      s.firstName.toLowerCase() === clean ||
      s.lastName.toLowerCase() === clean
  )
  return matched ? matched.id : null
}

async function resolveRoomId(roomIdentifier: string | null | undefined, locationStr: string | null | undefined, db: any): Promise<string | null> {
  if (roomIdentifier) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(roomIdentifier)) {
      const existing = await db.room.findUnique({ where: { id: roomIdentifier } })
      if (existing) return existing.id
    }
    const room = await db.room.findFirst({
      where: { name: { equals: roomIdentifier, mode: 'insensitive' } }
    })
    if (room) return room.id
  }
  if (locationStr) {
    const trimmed = locationStr.trim()
    const room = await db.room.findFirst({
      where: { name: { equals: trimmed, mode: 'insensitive' } }
    })
    if (room) return room.id
  }
  return null
}

export const schedulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.scheduleSlot.findMany({
      orderBy: { startTime: 'asc' },
      include: {
        section: true,
        sections: true,
        room: true,
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
      const targetId = resolvedId || input.sectionId
      return ctx.db.scheduleSlot.findMany({
        where: {
          OR: [
            { sectionId: targetId },
            { sections: { some: { id: targetId } } },
          ],
        },
        orderBy: { startTime: 'asc' },
        include: {
          section: true,
          sections: true,
          room: true,
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
          sections: true,
          room: true,
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
      roomId: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      sectionIds: z.array(z.string()).optional().nullable(),
      targetGroup: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const resolvedSectionIds: string[] = []
      if (input.sectionIds && input.sectionIds.length > 0) {
        for (const s of input.sectionIds) {
          const res = await resolveSectionId(s, ctx.db)
          if (res && !resolvedSectionIds.includes(res)) resolvedSectionIds.push(res)
        }
      } else if (input.sectionId) {
        const res = await resolveSectionId(input.sectionId, ctx.db)
        if (res) resolvedSectionIds.push(res)
      }

      return ctx.db.scheduleSlot.create({
        data: {
          title: input.title,
          description: input.description,
          type: input.type,
          startTime: input.startTime,
          endTime: input.endTime,
          location: input.location,
          roomId: input.roomId,
          sectionId: resolvedSectionIds[0] || null,
          sections: resolvedSectionIds.length > 0 ? {
            connect: resolvedSectionIds.map(id => ({ id }))
          } : undefined,
          targetGroup: input.targetGroup,
          speakerId: input.speakerId,
          assistantId: input.assistantId,
          rcId: input.rcId,
        },
        include: {
          section: true,
          sections: true,
          room: true,
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
      roomId: z.string().optional().nullable(),
      sectionId: z.string().optional().nullable(),
      sectionIds: z.array(z.string()).optional().nullable(),
      targetGroup: z.string().optional().nullable(),
      speakerId: z.string().optional().nullable(),
      assistantId: z.string().optional().nullable(),
      rcId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, sectionIds, sectionId, ...data } = input
      
      const updateData: any = { ...data }

      if (sectionIds !== undefined || sectionId !== undefined) {
        const resolvedSectionIds: string[] = []
        if (sectionIds && sectionIds.length > 0) {
          for (const s of sectionIds) {
            const res = await resolveSectionId(s, ctx.db)
            if (res && !resolvedSectionIds.includes(res)) resolvedSectionIds.push(res)
          }
        } else if (sectionId) {
          const res = await resolveSectionId(sectionId, ctx.db)
          if (res) resolvedSectionIds.push(res)
        }

        updateData.sectionId = resolvedSectionIds[0] || null
        updateData.sections = {
          set: resolvedSectionIds.map(id => ({ id }))
        }
      }

      return ctx.db.scheduleSlot.update({
        where: { id },
        data: updateData,
        include: {
          section: true,
          sections: true,
          room: true,
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
      sectionIds: z.array(z.string()).optional().nullable(),
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
      const inputSections = input.sectionIds && input.sectionIds.length > 0
        ? input.sectionIds
        : (input.sectionId ? [input.sectionId] : [])

      if (inputSections.length > 0) {
        const resolvedIds: string[] = []
        for (const s of inputSections) {
          const res = await resolveSectionId(s, ctx.db)
          if (res && !resolvedIds.includes(res)) resolvedIds.push(res)
        }
        if (resolvedIds.length > 0) {
          const sectionConflicts = await ctx.db.scheduleSlot.findMany({
            where: {
              id: input.id ? { not: input.id } : undefined,
              OR: [
                { sectionId: { in: resolvedIds } },
                { sections: { some: { id: { in: resolvedIds } } } },
              ],
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

  importSchedule: protectedProcedure
    .input(
      z.object({
        replaceAll: z.boolean().default(false),
        slots: z.array(
          z.object({
            id: z.string().optional().nullable(),
            title: z.string().min(1),
            description: z.string().optional().nullable(),
            type: z.string().optional().nullable(),
            startTime: z.coerce.date(),
            endTime: z.coerce.date(),
            location: z.string().optional().nullable(),
            roomId: z.string().optional().nullable(),
            roomName: z.string().optional().nullable(),
            sectionId: z.string().optional().nullable(),
            sectionName: z.string().optional().nullable(),
            sections: z.any().optional().nullable(),
            targetGroup: z.string().optional().nullable(),
            speakerId: z.string().optional().nullable(),
            speakerName: z.string().optional().nullable(),
            speaker: z.any().optional().nullable(),
            assistantId: z.string().optional().nullable(),
            assistantName: z.string().optional().nullable(),
            assistant: z.any().optional().nullable(),
            rcId: z.string().optional().nullable(),
            rcName: z.string().optional().nullable(),
            rc: z.any().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { replaceAll, slots } = input

      if (replaceAll) {
        await ctx.db.scheduleSlot.deleteMany({})
      }

      const validTypes: Record<string, 'LECTURE' | 'EXERCISE' | 'WORKSHOP' | 'ACTIVITY' | 'FREE' | 'SPECIAL' | 'MEAL'> = {
        LECTURE: 'LECTURE',
        COURS: 'LECTURE',
        EXERCISE: 'EXERCISE',
        EXERCICE: 'EXERCISE',
        EXERCICES: 'EXERCISE',
        WORKSHOP: 'WORKSHOP',
        ATELIER: 'WORKSHOP',
        ACTIVITY: 'ACTIVITY',
        ACTIVITE: 'ACTIVITY',
        ACTIVITÉ: 'ACTIVITY',
        FREE: 'FREE',
        LIBRE: 'FREE',
        SPECIAL: 'SPECIAL',
        SPÉCIAL: 'SPECIAL',
        MEAL: 'MEAL',
        REPAS: 'MEAL',
      }

      const createdSlots: any[] = []

      for (const item of slots) {
        // Normalize type
        const rawType = (item.type || 'LECTURE').toUpperCase().trim()
        const resolvedType = validTypes[rawType] || 'LECTURE'

        // Resolve sections
        const rawSectionList: string[] = []
        if (Array.isArray(item.sections)) {
          for (const s of item.sections) {
            if (typeof s === 'string' && s.trim()) rawSectionList.push(s.trim())
            else if (s && typeof s === 'object' && s.name) rawSectionList.push(s.name.trim())
            else if (s && typeof s === 'object' && s.id) rawSectionList.push(s.id.trim())
          }
        } else if (typeof item.sections === 'string' && item.sections.trim()) {
          rawSectionList.push(...item.sections.split(/[,;/]+/).map((s: string) => s.trim()).filter(Boolean))
        }

        if (item.sectionName) rawSectionList.push(item.sectionName.trim())
        if (item.sectionId) rawSectionList.push(item.sectionId.trim())

        const resolvedSectionIds: string[] = []
        for (const sec of rawSectionList) {
          const res = await resolveSectionId(sec, ctx.db)
          if (res && !resolvedSectionIds.includes(res)) {
            resolvedSectionIds.push(res)
          }
        }

        // Resolve room
        const resolvedRoomId = await resolveRoomId(item.roomId || item.roomName, item.location, ctx.db)

        // Resolve staff
        const resolvedSpeakerId = await resolveStaffId(item.speakerId || item.speakerName || item.speaker, ctx.db)
        const resolvedAssistantId = await resolveStaffId(item.assistantId || item.assistantName || item.assistant, ctx.db)
        const resolvedRcId = await resolveStaffId(item.rcId || item.rcName || item.rc, ctx.db)

        // Resolve targetGroup
        let targetGroup = item.targetGroup?.toUpperCase()?.trim() || null
        if (targetGroup === 'ALL' || targetGroup === 'TOUS' || targetGroup === '') {
          targetGroup = null
        }

        const slot = await ctx.db.scheduleSlot.create({
          data: {
            title: item.title,
            description: item.description || null,
            type: resolvedType,
            startTime: item.startTime,
            endTime: item.endTime,
            location: item.location || null,
            roomId: resolvedRoomId,
            sectionId: resolvedSectionIds[0] || null,
            sections: resolvedSectionIds.length > 0 ? {
              connect: resolvedSectionIds.map((id) => ({ id }))
            } : undefined,
            targetGroup: targetGroup,
            speakerId: resolvedSpeakerId,
            assistantId: resolvedAssistantId,
            rcId: resolvedRcId,
          },
        })
        createdSlots.push(slot)
      }

      return {
        success: true,
        count: createdSlots.length,
        total: createdSlots.length,
      }
    }),
})
