import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { router, publicProcedure, protectedProcedure } from '../trpc/trpc'
import { TRPCError } from '@trpc/server'

export const authRouter = router({
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await ctx.db.user.findUnique({
        where: { email: input.email },
      })

      if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })

      const valid = await bcrypt.compare(input.password, user.password)
      if (!valid) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid credentials' })

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      )

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      }
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        sectionId: true,
      },
    })

    if (!user) throw new TRPCError({ code: 'NOT_FOUND' })
    return user
  }),
})