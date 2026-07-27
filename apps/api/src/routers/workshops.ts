import { EventEmitter, on } from 'events'
import { z } from 'zod'
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
          dates: true,
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
          dates: true,
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

  onUpdated: protectedProcedure.subscription(async function* ({ signal }) {
    for await (const _ of on(workshopEmitter, 'updated', { signal })) {
      yield { updated: true }
    }
  }),
})
