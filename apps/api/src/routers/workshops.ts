import { EventEmitter, on } from 'events'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc/trpc'

export const workshopEmitter = new EventEmitter()
workshopEmitter.setMaxListeners(100)

export const workshopsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.workshop.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        room: true,
        favorites: {
          select: {
            userId: true,
          },
        },
        dates: {
          orderBy: { startTime: 'asc' },
          include: {
            room: true,
            registrations: {
              include: {
                user: {
                  include: {
                    section: true,
                  },
                },
              },
            },
          },
        },
      },
    })
  }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      location: z.string().min(1),
      roomId: z.string().nullable().optional(),
      description: z.string().min(1),
      image: z.string().optional(),
      category: z.string().nullable().optional(),
      requiresRegistration: z.boolean().default(false),
      onlyOneSlotPerUser: z.boolean().default(false),
      isRegistrationClosed: z.boolean().default(false),
      externalRegistrationUrl: z.string().nullable().optional(),
      infoUrl: z.string().nullable().optional(),
      infoDescription: z.string().nullable().optional(),
      maxParticipants: z.number().nullable().optional(),
      dates: z.array(z.object({
        startTime: z.string(),
        endTime: z.string(),
        location: z.string().nullable().optional(),
        roomId: z.string().nullable().optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { dates, roomId, ...data } = input
      const workshop = await ctx.db.workshop.create({
        data: {
          ...data,
          category: data.category || 'Workshop',
          roomId: roomId || null,
          dates: {
            create: dates.map(d => ({
              startTime: new Date(d.startTime),
              endTime: new Date(d.endTime),
              location: d.location || data.location || null,
              roomId: d.roomId || roomId || null,
            })),
          },
        },
        include: {
          room: true,
          dates: {
            include: {
              room: true,
              registrations: true,
            },
          },
        },
      })
      workshopEmitter.emit('updated')
      return workshop
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      location: z.string().min(1).optional(),
      roomId: z.string().nullable().optional(),
      description: z.string().min(1).optional(),
      image: z.string().optional(),
      category: z.string().nullable().optional(),
      requiresRegistration: z.boolean().optional(),
      onlyOneSlotPerUser: z.boolean().optional(),
      isRegistrationClosed: z.boolean().optional(),
      externalRegistrationUrl: z.string().nullable().optional(),
      infoUrl: z.string().nullable().optional(),
      infoDescription: z.string().nullable().optional(),
      maxParticipants: z.number().nullable().optional(),
      dates: z.array(z.object({
        id: z.string().optional(),
        startTime: z.string(),
        endTime: z.string(),
        location: z.string().nullable().optional(),
        roomId: z.string().nullable().optional(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, dates, roomId, ...data } = input

      const updateData: any = { ...data }
      if (roomId !== undefined) {
        updateData.roomId = roomId || null
      }

      if (dates) {
        const existingSessions = await ctx.db.workshopSession.findMany({
          where: { workshopId: id },
        })
        const incomingIds = dates.map(d => d.id).filter(Boolean) as string[]

        // Delete sessions that were removed in the UI
        const toDelete = existingSessions.filter(s => !incomingIds.includes(s.id))
        if (toDelete.length > 0) {
          await ctx.db.workshopSession.deleteMany({
            where: { id: { in: toDelete.map(s => s.id) } },
          })
        }

        // Update existing sessions or create new ones without losing registrations
        for (const d of dates) {
          const sessionLocation = d.location || data.location || null
          const sessionRoomId = d.roomId !== undefined ? (d.roomId || null) : (roomId !== undefined ? (roomId || null) : null)

          if (d.id && existingSessions.some(s => s.id === d.id)) {
            await ctx.db.workshopSession.update({
              where: { id: d.id },
              data: {
                startTime: new Date(d.startTime),
                endTime: new Date(d.endTime),
                location: sessionLocation,
                roomId: sessionRoomId,
              },
            })
          } else {
            await ctx.db.workshopSession.create({
              data: {
                workshopId: id,
                startTime: new Date(d.startTime),
                endTime: new Date(d.endTime),
                location: sessionLocation,
                roomId: sessionRoomId,
              },
            })
          }
        }
      }

      const workshop = await ctx.db.workshop.update({
        where: { id },
        data: updateData,
        include: {
          room: true,
          dates: {
            include: {
              room: true,
              registrations: true,
            },
          },
        },
      })
      workshopEmitter.emit('updated')
      return workshop
    }),

  checkConflicts: protectedProcedure
    .input(z.object({
      workshopId: z.string().optional(),
      slots: z.array(z.object({
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        roomId: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
      })),
    }))
    .query(async ({ input, ctx }) => {
      const conflicts: Array<{
        slotIndex: number
        type: 'SCHEDULE' | 'WORKSHOP' | 'TASK' | 'AVAILABILITY'
        message: string
        severity: 'WARNING' | 'ERROR'
      }> = []

      const allRooms = await ctx.db.room.findMany({
        include: { availabilities: true },
      })
      const roomMap = new Map(allRooms.map((r: any) => [r.id, r]))
      const roomNameMap = new Map(allRooms.map((r: any) => [r.name.trim().toUpperCase(), r]))

      for (let i = 0; i < input.slots.length; i++) {
        const slot = input.slots[i]
        if (!slot.startTime || !slot.endTime) continue
        const startTime = new Date(slot.startTime)
        const endTime = new Date(slot.endTime)
        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime()) || endTime <= startTime) continue

        // Find associated room entity
        let targetRoom: any = null
        if (slot.roomId && roomMap.has(slot.roomId)) {
          targetRoom = roomMap.get(slot.roomId)
        } else if (slot.location) {
          const locName = slot.location.trim().toUpperCase()
          targetRoom = roomNameMap.get(locName) || null
        }

        const targetRoomId = targetRoom?.id || slot.roomId || null
        const locationName = targetRoom?.name || slot.location || null

        if (!targetRoomId && !locationName) continue

        const normalizedLocationName = (locationName || targetRoom?.name || '').trim().toUpperCase()

        // 1. Check ScheduleSlot conflicts
        const scheduleSlots = await ctx.db.scheduleSlot.findMany({
          where: {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              targetRoomId ? { roomId: targetRoomId } : undefined,
              locationName ? { location: { not: null } } : undefined,
            ].filter(Boolean) as any,
          },
        })
        for (const s of scheduleSlots) {
          const sTokens = (s.location || '').split(/[,;/]+/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
          const isMatch = (targetRoomId && s.roomId === targetRoomId) || (normalizedLocationName && sTokens.includes(normalizedLocationName))
          if (isMatch) {
            conflicts.push({
              slotIndex: i,
              type: 'SCHEDULE',
              severity: 'ERROR',
              message: `La salle '${locationName || targetRoom?.name}' est occupée par le cours '${s.title}' (${new Date(s.startTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })} - ${new Date(s.endTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}).`,
            })
          }
        }

        // 2. Check other WorkshopSession conflicts
        const workshopSessions = await ctx.db.workshopSession.findMany({
          where: {
            workshopId: input.workshopId ? { not: input.workshopId } : undefined,
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              targetRoomId ? { roomId: targetRoomId } : undefined,
              locationName ? { location: { not: null } } : undefined,
              targetRoomId ? { workshop: { roomId: targetRoomId } } : undefined,
              locationName ? { workshop: { location: { not: null } } } : undefined,
            ].filter(Boolean) as any,
          },
          include: { workshop: true },
        })
        for (const ws of workshopSessions) {
          const wsLoc = ws.location || ws.workshop?.location || ''
          const wsTokens = wsLoc.split(/[,;/]+/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
          const wsRoomId = ws.roomId || ws.workshop?.roomId
          const isMatch = (targetRoomId && wsRoomId === targetRoomId) || (normalizedLocationName && wsTokens.includes(normalizedLocationName))
          if (isMatch) {
            conflicts.push({
              slotIndex: i,
              type: 'WORKSHOP',
              severity: 'ERROR',
              message: `La salle '${locationName || targetRoom?.name}' est occupée par le workshop '${ws.workshop.title}' (${new Date(ws.startTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })} - ${new Date(ws.endTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}).`,
            })
          }
        }

        // 3. Check Task conflicts
        const tasks = await ctx.db.task.findMany({
          where: {
            startTime: { lt: endTime },
            endTime: { gt: startTime },
            OR: [
              targetRoomId ? { roomId: targetRoomId } : undefined,
              locationName ? { location: { not: null } } : undefined,
            ].filter(Boolean) as any,
          },
        })
        for (const t of tasks) {
          const tTokens = (t.location || '').split(/[,;/]+/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
          const isMatch = (targetRoomId && t.roomId === targetRoomId) || (normalizedLocationName && tTokens.includes(normalizedLocationName))
          if (isMatch) {
            conflicts.push({
              slotIndex: i,
              type: 'TASK',
              severity: 'ERROR',
              message: `La salle '${locationName || targetRoom?.name}' est réservée pour la tâche '${t.name}' (${new Date(t.startTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })} - ${new Date(t.endTime).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}).`,
            })
          }
        }

        // 4. Check Room Availability if targetRoom is defined and has availabilities
        if (targetRoom && targetRoom.availabilities && targetRoom.availabilities.length > 0) {
          const isAvailable = targetRoom.availabilities.some((avail: any) => {
            const aStart = new Date(avail.startTime).getTime()
            const aEnd = new Date(avail.endTime).getTime()
            return startTime.getTime() >= aStart && endTime.getTime() <= aEnd
          })
          if (!isAvailable) {
            conflicts.push({
              slotIndex: i,
              type: 'AVAILABILITY',
              severity: 'WARNING',
              message: `La salle '${targetRoom.name}' n'est pas déclarée comme disponible sur ce créneau dans le planning des salles.`,
            })
          }
        }
      }

      return conflicts
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const workshop = await ctx.db.workshop.delete({
        where: { id: input.id },
      })
      workshopEmitter.emit('updated')
      return workshop
    }),

  register: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      userId: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const session = await ctx.db.workshopSession.findUnique({
        where: { id: input.sessionId },
        include: {
          workshop: true,
          registrations: true,
        },
      })

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Session introuvable' })
      }

      if (session.workshop.isRegistrationClosed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Les inscriptions pour cet atelier sont actuellement closes.',
        })
      }

      if (session.workshop.requiresRegistration && session.workshop.maxParticipants) {
        if (session.registrations.length >= session.workshop.maxParticipants) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce créneau est complet' })
        }
      }

      const email = input.email || (ctx.user as any)?.email || null
      const firstName = input.firstName || (ctx.user as any)?.firstName || 'Étudiant'
      const lastName = input.lastName || (ctx.user as any)?.lastName || 'Inscrit'

      let userId = input.userId || null
      if (!userId && !input.email && !input.firstName && !input.lastName) {
        userId = (ctx.user as any)?.id || null
      } else if (!userId && email) {
        const matchedUser = await ctx.db.user.findUnique({ where: { email } })
        if (matchedUser) {
          userId = matchedUser.id
        }
      }

      // Check if already registered to this session
      const existingInSession = await ctx.db.workshopRegistration.findFirst({
        where: {
          sessionId: input.sessionId,
          OR: [
            userId ? { userId } : undefined,
            email ? { email } : undefined,
          ].filter(Boolean) as any,
        },
      })

      if (existingInSession) {
        return existingInSession
      }

      // If workshop limits users to 1 slot, verify if already registered to any session of this workshop
      if (session.workshop.onlyOneSlotPerUser) {
        const existingInWorkshop = await ctx.db.workshopRegistration.findFirst({
          where: {
            session: {
              workshopId: session.workshopId,
            },
            OR: [
              userId ? { userId } : undefined,
              email ? { email } : undefined,
            ].filter(Boolean) as any,
          },
        })

        if (existingInWorkshop) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ce participant est déjà inscrit à un créneau pour cet atelier (limité à 1 créneau par participant).',
          })
        }
      }

      const registration = await ctx.db.workshopRegistration.create({
        data: {
          sessionId: input.sessionId,
          userId: userId,
          firstName: firstName,
          lastName: lastName,
          email: email,
        },
      })

      workshopEmitter.emit('updated')
      return registration
    }),

  unregister: protectedProcedure
    .input(z.object({
      sessionId: z.string(),
      userId: z.string().optional(),
      email: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      let orConditions: any[] = []
      if (input.email) {
        orConditions.push({ email: input.email })
      }
      if (input.userId) {
        orConditions.push({ userId: input.userId })
      }
      if (orConditions.length === 0) {
        const userId = (ctx.user as any)?.id || null
        const email = (ctx.user as any)?.email || null
        if (userId) orConditions.push({ userId })
        if (email) orConditions.push({ email })
      }

      if (orConditions.length > 0) {
        await ctx.db.workshopRegistration.deleteMany({
          where: {
            sessionId: input.sessionId,
            OR: orConditions,
          },
        })
      }

      workshopEmitter.emit('updated')
      return { success: true }
    }),

  toggleAttendance: protectedProcedure
    .input(z.object({
      registrationId: z.string(),
      isPresent: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const reg = await ctx.db.workshopRegistration.update({
        where: { id: input.registrationId },
        data: { isPresent: input.isPresent },
      })
      workshopEmitter.emit('updated')
      return reg
    }),

  toggleFavorite: protectedProcedure
    .input(z.object({
      workshopId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx.user as any)?.id
      if (!userId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' })
      }

      const existing = await ctx.db.workshopFavorite.findUnique({
        where: {
          userId_workshopId: {
            userId,
            workshopId: input.workshopId,
          },
        },
      })

      if (existing) {
        await ctx.db.workshopFavorite.delete({
          where: { id: existing.id },
        })
        workshopEmitter.emit('updated')
        return { isFavorite: false }
      } else {
        await ctx.db.workshopFavorite.create({
          data: {
            userId,
            workshopId: input.workshopId,
          },
        })
        workshopEmitter.emit('updated')
        return { isFavorite: true }
      }
    }),

  onUpdated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const _ of on(workshopEmitter, 'updated', { signal })) {
      yield { updated: true }
    }
  }),
})

