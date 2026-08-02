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
        dates: {
          orderBy: { startTime: 'asc' },
          include: {
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
      description: z.string().min(1),
      image: z.string().optional(),
      requiresRegistration: z.boolean().default(false),
      maxParticipants: z.number().nullable().optional(),
      dates: z.array(z.object({
        startTime: z.string(),
        endTime: z.string(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const { dates, ...data } = input
      const workshop = await ctx.db.workshop.create({
        data: {
          ...data,
          dates: {
            create: dates.map(d => ({
              startTime: new Date(d.startTime),
              endTime: new Date(d.endTime),
            })),
          },
        },
        include: {
          dates: {
            include: {
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
      description: z.string().min(1).optional(),
      image: z.string().optional(),
      requiresRegistration: z.boolean().optional(),
      maxParticipants: z.number().nullable().optional(),
      dates: z.array(z.object({
        startTime: z.string(),
        endTime: z.string(),
      })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, dates, ...data } = input

      const updateData: any = { ...data }
      if (dates) {
        updateData.dates = {
          deleteMany: {},
          create: dates.map(d => ({
            startTime: new Date(d.startTime),
            endTime: new Date(d.endTime),
          })),
        }
      }

      const workshop = await ctx.db.workshop.update({
        where: { id },
        data: updateData,
        include: {
          dates: {
            include: {
              registrations: true,
            },
          },
        },
      })
      workshopEmitter.emit('updated')
      return workshop
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

      if (session.workshop.requiresRegistration && session.workshop.maxParticipants) {
        if (session.registrations.length >= session.workshop.maxParticipants) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ce créneau est complet' })
        }
      }

      const userId = (ctx.user as any)?.id || null
      const email = input.email || (ctx.user as any)?.email || 'etudiant@epfl.ch'
      const firstName = input.firstName || (ctx.user as any)?.firstName || 'Étudiant'
      const lastName = input.lastName || (ctx.user as any)?.lastName || 'Inscrit'

      // Check existing registration to avoid duplicates
      const existing = await ctx.db.workshopRegistration.findFirst({
        where: {
          sessionId: input.sessionId,
          OR: [
            userId ? { userId } : undefined,
            { email },
          ].filter(Boolean) as any,
        },
      })

      if (existing) {
        return existing
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
      email: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx.user as any)?.id || null
      const email = input.email || (ctx.user as any)?.email || 'etudiant@epfl.ch'

      await ctx.db.workshopRegistration.deleteMany({
        where: {
          sessionId: input.sessionId,
          OR: [
            userId ? { userId } : undefined,
            email ? { email } : undefined,
          ].filter(Boolean) as any,
        },
      })

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

  onUpdated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const _ of on(workshopEmitter, 'updated', { signal })) {
      yield { updated: true }
    }
  }),
})

