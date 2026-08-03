import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const shiftsRouter = router({
  list: protectedProcedure
    .input(z.object({ staffMemberId: z.string().optional() }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.db.shift.findMany({
        where: input?.staffMemberId ? { staffMemberId: input.staffMemberId } : undefined,
        orderBy: { startTime: 'asc' },
        include: {
          staffMember: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
    }),

  create: protectedProcedure
    .input(
      z.object({
        staffMemberId: z.string(),
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        location: z.string().optional().nullable(),
        type: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return ctx.db.shift.create({
        data: input,
        include: {
          staffMember: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        staffMemberId: z.string().optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        location: z.string().optional().nullable(),
        type: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input
      return ctx.db.shift.update({
        where: { id },
        data,
        include: {
          staffMember: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.shift.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),
})
