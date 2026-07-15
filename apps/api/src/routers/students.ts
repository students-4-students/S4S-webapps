import { z } from 'zod'
import { router, publicProcedure, staffProcedure } from '../trpc/trpc'
import { EventEmitter, on } from 'events'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { TRPCError } from '@trpc/server'

export const studentsEmitter = new EventEmitter()
studentsEmitter.setMaxListeners(100)

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

export const studentsRouter = router({
  list: staffProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { role: 'PARTICIPANT' },
      orderBy: { lastName: 'asc' },
      include: {
        section: true,
      },
    })
  }),

  listSections: staffProcedure.query(async ({ ctx }) => {
    return ctx.db.section.findMany({
      orderBy: { name: 'asc' },
    })
  }),

  create: staffProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        sectionName: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Generate secure random password for DB non-null requirement
      const tempPassword = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(tempPassword, 10)
      const sectionId = await resolveSectionId(input.sectionName, ctx.db)

      const student = await ctx.db.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          password: hashedPassword,
          role: 'PARTICIPANT',
          sectionId: sectionId,
        },
        include: {
          section: true,
        },
      })

      // Generate a setup token valid for 24h
      const token = jwt.sign(
        { userId: student.id, email: student.email, action: 'setup-password' },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      )

      console.log(`\n========================================================================\n[STUDENT INVITE] Setup password link for ${student.firstName} ${student.lastName} (${student.email}):\nhttp://localhost:5173/setup-password?token=${token}\n========================================================================\n`)

      studentsEmitter.emit('updated')
      return {
        student,
        token,
        setupUrl: `http://localhost:5173/setup-password?token=${token}`,
      }
    }),

  update: staffProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        sectionName: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, sectionName, ...data } = input
      const updateData: any = { ...data }

      if (sectionName !== undefined) {
        updateData.sectionId = await resolveSectionId(sectionName, ctx.db)
      }

      const student = await ctx.db.user.update({
        where: { id },
        data: updateData,
        include: {
          section: true,
        },
      })

      studentsEmitter.emit('updated')
      return student
    }),

  delete: staffProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.delete({
        where: { id: input.id },
      })
      studentsEmitter.emit('updated')
      return { success: true }
    }),

  importStudents: staffProcedure
    .input(
      z.array(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          email: z.string().email(),
          sectionName: z.string().optional().nullable(),
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      const createdStudents: any[] = []

      for (const item of input) {
        const sectionId = await resolveSectionId(item.sectionName, ctx.db)
        
        // Generate secure random password
        const tempPassword = crypto.randomUUID()
        const tempPasswordHash = await bcrypt.hash(tempPassword, 10)

        // Upsert by email
        const student = await ctx.db.user.upsert({
          where: { email: item.email },
          update: {
            firstName: item.firstName,
            lastName: item.lastName,
            sectionId: sectionId,
          },
          create: {
            firstName: item.firstName,
            lastName: item.lastName,
            email: item.email,
            password: tempPasswordHash,
            role: 'PARTICIPANT',
            sectionId: sectionId,
          },
          include: {
            section: true,
          },
        })

        // Generate a setup token valid for 24h
        const token = jwt.sign(
          { userId: student.id, email: student.email, action: 'setup-password' },
          process.env.JWT_SECRET!,
          { expiresIn: '24h' }
        )

        //TODO: send email
        console.log(`[STUDENT INVITE] Setup password link for ${student.firstName} ${student.lastName} (${student.email}): http://localhost:5173/setup-password?token=${token}`)
        
        createdStudents.push(student)
      }

      studentsEmitter.emit('updated')
      return createdStudents
    }),

  resetPassword: staffProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const student = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.id, role: 'PARTICIPANT' }
      })

      // Generate secure random password
      const tempPassword = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      await ctx.db.user.update({
        where: { id: student.id },
        data: { password: hashedPassword }
      })

      // Generate a setup token valid for 24h
      const token = jwt.sign(
        { userId: student.id, email: student.email, action: 'setup-password' },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      )

      console.log(`\n========================================================================\n[PASSWORD RESET] Setup password link for ${student.firstName} ${student.lastName} (${student.email}):\nhttp://localhost:5173/setup-password?token=${token}\n========================================================================\n`)

      studentsEmitter.emit('updated')
      return {
        setupUrl: `http://localhost:5173/setup-password?token=${token}`
      }
    }),

  setupPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        password: z.string().min(4),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const decoded = jwt.verify(input.token, process.env.JWT_SECRET!) as {
          userId: string
          action: string
        }

        if (decoded.action !== 'setup-password') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Action non autorisée' })
        }

        const hashedPassword = await bcrypt.hash(input.password, 10)
        await ctx.db.user.update({
          where: { id: decoded.userId },
          data: { password: hashedPassword },
        })

        return { success: true }
      } catch (err: any) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Le lien d\'invitation est invalide ou a expiré.',
        })
      }
    }),

  onUpdated: staffProcedure.subscription(async function* ({ signal }) {
    for await (const [] of on(studentsEmitter, 'updated', { signal })) {
      yield { updated: true }
    }
  }),
})
