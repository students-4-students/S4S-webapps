import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'
import { TRPCError } from '@trpc/server'

export const roomsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.room.findMany({
      orderBy: { name: 'asc' },
      include: {
        availabilities: {
          orderBy: [
            { date: 'asc' },
            { startTime: 'asc' },
          ],
        },
        scheduleSlots: {
          select: { id: true, title: true, startTime: true, endTime: true },
        },
        workshops: {
          select: { id: true, title: true },
        },
        workshopSessions: {
          select: { id: true, startTime: true, endTime: true, workshop: { select: { id: true, title: true } } },
        },
        tasks: {
          select: { id: true, name: true, startTime: true, endTime: true },
        },
      },
    })
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const room = await ctx.db.room.findUnique({
        where: { id: input.id },
        include: {
          availabilities: {
            orderBy: [
              { date: 'asc' },
              { startTime: 'asc' },
            ],
          },
          scheduleSlots: {
            orderBy: { startTime: 'asc' },
            include: { section: true },
          },
          workshops: {
            include: { dates: true },
          },
          workshopSessions: {
            orderBy: { startTime: 'asc' },
            include: { workshop: true },
          },
          tasks: {
            orderBy: { startTime: 'asc' },
          },
        },
      })
      if (!room) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Room not found' })
      }
      return room
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        building: z.string().optional().nullable(),
        floor: z.number().int().optional().nullable(),
        capacity: z.number().int().optional().nullable(),
        isComputerRoom: z.boolean().optional().default(false),
        description: z.string().optional().nullable(),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
        availabilities: z
          .array(
            z.object({
              date: z.coerce.date(),
              startTime: z.coerce.date(),
              endTime: z.coerce.date(),
              notes: z.string().optional().nullable(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.db.room.findUnique({
        where: { name: input.name },
      })
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A room named "${input.name}" already exists`,
        })
      }

      const { availabilities, ...roomData } = input

      return ctx.db.room.create({
        data: {
          ...roomData,
          floor: input.floor ?? 0,
          isComputerRoom: input.isComputerRoom ?? false,
          availabilities: availabilities?.length
            ? {
                create: availabilities.map((a) => ({
                  date: a.date,
                  startTime: a.startTime,
                  endTime: a.endTime,
                  notes: a.notes,
                })),
              }
            : undefined,
        },
        include: {
          availabilities: true,
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        building: z.string().optional().nullable(),
        floor: z.number().int().optional().nullable(),
        capacity: z.number().int().optional().nullable(),
        isComputerRoom: z.boolean().optional(),
        description: z.string().optional().nullable(),
        latitude: z.number().optional().nullable(),
        longitude: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      if (data.name) {
        const existing = await ctx.db.room.findFirst({
          where: {
            name: data.name,
            NOT: { id },
          },
        })
        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: `A room named "${data.name}" already exists`,
          })
        }
      }

      return ctx.db.room.update({
        where: { id },
        data,
        include: {
          availabilities: true,
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.room.delete({
        where: { id: input.id },
      })
    }),

  addAvailability: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        date: z.coerce.date(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.roomAvailability.create({
        data: {
          roomId: input.roomId,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          notes: input.notes,
        },
      })
    }),

  updateAvailability: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        date: z.coerce.date().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.roomAvailability.update({
        where: { id },
        data,
      })
    }),

  deleteAvailability: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.roomAvailability.delete({
        where: { id: input.id },
      })
    }),

  bulkImport: protectedProcedure
    .input(
      z.object({
        rooms: z.array(
          z.object({
            name: z.string().min(1),
            building: z.string().optional().nullable(),
            floor: z.number().int().optional().nullable(),
            capacity: z.number().int().optional().nullable(),
            isComputerRoom: z.boolean().optional().default(false),
            description: z.string().optional().nullable(),
            latitude: z.number().optional().nullable(),
            longitude: z.number().optional().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let createdCount = 0
      let updatedCount = 0

      for (const r of input.rooms) {
        const existing = await ctx.db.room.findUnique({
          where: { name: r.name },
        })

        if (existing) {
          await ctx.db.room.update({
            where: { id: existing.id },
            data: {
              building: r.building ?? existing.building,
              floor: r.floor ?? existing.floor,
              capacity: r.capacity ?? existing.capacity,
              isComputerRoom: r.isComputerRoom ?? existing.isComputerRoom,
              description: r.description ?? existing.description,
              latitude: r.latitude ?? existing.latitude,
              longitude: r.longitude ?? existing.longitude,
            },
          })
          updatedCount++
        } else {
          await ctx.db.room.create({
            data: {
              name: r.name,
              building: r.building,
              floor: r.floor ?? 0,
              capacity: r.capacity,
              isComputerRoom: r.isComputerRoom ?? false,
              description: r.description,
              latitude: r.latitude,
              longitude: r.longitude,
            },
          })
          createdCount++
        }
      }

      return { createdCount, updatedCount, total: input.rooms.length }
    }),

  bulkImportAvailabilities: protectedProcedure
    .input(
      z.object({
        slots: z.array(
          z.object({
            roomName: z.string().min(1),
            startTime: z.coerce.date(),
            endTime: z.coerce.date(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      let createdCount = 0

      for (const slot of input.slots) {
        const room = await ctx.db.room.findUnique({
          where: { name: slot.roomName },
        })

        if (room) {
          await ctx.db.roomAvailability.create({
            data: {
              roomId: room.id,
              date: slot.startTime,
              startTime: slot.startTime,
              endTime: slot.endTime,
            },
          })
          createdCount++
        }
      }

      return { createdCount, total: input.slots.length }
    }),
})
