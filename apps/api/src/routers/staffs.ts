import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'
import { EventEmitter, on } from 'events'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { TRPCError } from '@trpc/server'
import { sendPasswordReset } from '../lib/mailer'

export const staffsEmitter = new EventEmitter()
staffsEmitter.setMaxListeners(100)

export const staffsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const staffs = await ctx.db.staffMember.findMany({
      orderBy: { lastName: 'asc' },
      include: {
        speakerSlots: { select: { id: true, title: true } },
        assistantSlots: { select: { id: true, title: true } },
        rcSlots: { select: { id: true, title: true } },
        Class_SpeakerClasses: { select: { id: true, name: true } },
        Class_AssistantClasses: { select: { id: true, name: true } },
        Class_RcClasses: { select: { id: true, name: true } },
      },
    });
    return staffs;
  }),

  listClassNames: protectedProcedure.query(async ({ ctx }) => {
    const slots = await ctx.db.scheduleSlot.findMany({
      select: { title: true },
    })
    const classes = await ctx.db.class.findMany({
      select: { name: true },
    })
    const allNames = new Set<string>()
    slots.forEach((s) => {
      if (s.title && s.title.trim()) allNames.add(s.title.trim())
    })
    classes.forEach((c) => {
      if (c.name && c.name.trim()) allNames.add(c.name.trim())
    })
    return Array.from(allNames).sort((a, b) => a.localeCompare(b))
  }),

  create: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.string().min(1),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).default('ACTIVE'),
        isPresent: z.boolean().default(false),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        score: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const newStaff = await ctx.db.staffMember.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          status: input.status,
          isPresent: input.isPresent,
          email: input.email || null,
          phone: input.phone || null,
          score: input.score,
        },
      });

      staffsEmitter.emit('updated')
      return newStaff;
    }),

  importStaffs: protectedProcedure
    .input(
      z.array(
        z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          role: z.string().min(1),
          status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).default('ACTIVE'),
          isPresent: z.boolean().default(false),
          email: z.string().email().or(z.string().length(0)).optional().nullable(),
          phone: z.string().optional().nullable(),
          telegramUsername: z.string().optional().nullable(),
          score: z.number().int().min(0).optional().default(0),
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      console.log(`[DEBUG] [StaffsRouter] Bulk importing ${input.length} staff members`);
      
      const createdStaffs: any[] = [];
      for (const item of input) {
        const staff = await ctx.db.staffMember.create({
          data: {
            firstName: item.firstName,
            lastName: item.lastName,
            role: item.role,
            status: item.status,
            isPresent: item.isPresent,
            email: item.email || null,
            phone: item.phone || null,
            telegramUsername: item.telegramUsername || null,
            score: item.score,
          },
        });
        createdStaffs.push(staff);
      }
      
      console.log(`[DEBUG] [StaffsRouter] Bulk import complete. Created ${createdStaffs.length} staffs`);
      staffsEmitter.emit('updated')
      return createdStaffs;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        role: z.string().min(1).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']).optional(),
        isPresent: z.boolean().optional(),
        email: z.string().email().or(z.string().length(0)).optional().nullable(),
        phone: z.string().optional().nullable(),
        telegramUsername: z.string().optional().nullable(),
        score: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      console.log(`[DEBUG] [StaffsRouter] Updating staff member ${id} with:`, JSON.stringify(data));
      const updated = await ctx.db.staffMember.update({
        where: { id },
        data: {
          ...data,
          email: data.email === '' ? null : data.email,
        },
      });
      staffsEmitter.emit('updated')
      return updated;
    }),

  assignToCourses: protectedProcedure
    .input(
      z.object({
        staffMemberId: z.string(),
        speakerClassNames: z.array(z.string()).optional().default([]),
        assistantClassNames: z.array(z.string()).optional().default([]),
        rcClassNames: z.array(z.string()).optional().default([]),
        speakerSlotIds: z.array(z.string()).optional().default([]),
        assistantSlotIds: z.array(z.string()).optional().default([]),
        rcSlotIds: z.array(z.string()).optional().default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log(`[DEBUG] [StaffsRouter] Re-assigning classes for staff member ${input.staffMemberId}`);
      
      const { staffMemberId, speakerClassNames = [], assistantClassNames = [], rcClassNames = [] } = input;

      // Handle Speaker assignments by Class Name
      await ctx.db.scheduleSlot.updateMany({
        where: { speakerId: staffMemberId, title: { notIn: speakerClassNames } },
        data: { speakerId: null },
      });
      if (speakerClassNames.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { title: { in: speakerClassNames } },
          data: { speakerId: staffMemberId },
        });
      }

      // Handle Assistant assignments by Class Name
      await ctx.db.scheduleSlot.updateMany({
        where: { assistantId: staffMemberId, title: { notIn: assistantClassNames } },
        data: { assistantId: null },
      });
      if (assistantClassNames.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { title: { in: assistantClassNames } },
          data: { assistantId: staffMemberId },
        });
      }

      // Handle RC assignments by Class Name
      await ctx.db.scheduleSlot.updateMany({
        where: { rcId: staffMemberId, title: { notIn: rcClassNames } },
        data: { rcId: null },
      });
      if (rcClassNames.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { title: { in: rcClassNames } },
          data: { rcId: staffMemberId },
        });
      }

      // Also update Class relations if Class entities exist in DB
      const allMatchingClasses = await ctx.db.class.findMany({ select: { id: true, name: true } });
      const speakerClassIds = allMatchingClasses.filter(c => speakerClassNames.includes(c.name)).map(c => ({ id: c.id }));
      const assistantClassIds = allMatchingClasses.filter(c => assistantClassNames.includes(c.name)).map(c => ({ id: c.id }));
      const rcClassIds = allMatchingClasses.filter(c => rcClassNames.includes(c.name)).map(c => ({ id: c.id }));

      await ctx.db.staffMember.update({
        where: { id: staffMemberId },
        data: {
          Class_SpeakerClasses: { set: speakerClassIds },
          Class_AssistantClasses: { set: assistantClassIds },
          Class_RcClasses: { set: rcClassIds },
        },
      });

      console.log(`[DEBUG] [StaffsRouter] Re-assigned classes successfully`);
      staffsEmitter.emit('updated')
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[DEBUG] [StaffsRouter] Deleting staff member ${input.id}`);
      await ctx.db.staffMember.delete({
        where: { id: input.id },
      });
      staffsEmitter.emit('updated')
      return { success: true };
    }),

  resetPassword: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const staff = await ctx.db.staffMember.findUniqueOrThrow({
        where: { id: input.id },
        include: { user: true },
      })

      let user = staff.user

      if (!user) {
        if (staff.email) {
          const existingUser = await ctx.db.user.findUnique({
            where: { email: staff.email },
          })
          if (existingUser) {
            user = existingUser
            await ctx.db.staffMember.update({
              where: { id: staff.id },
              data: { userId: user.id },
            })
          }
        }

        if (!user) {
          if (!staff.email) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Veuillez d\'abord renseigner une adresse email pour ce membre du staff.',
            })
          }

          const tempPassword = crypto.randomUUID()
          const hashedPassword = await bcrypt.hash(tempPassword, 10)

          user = await ctx.db.user.create({
            data: {
              firstName: staff.firstName,
              lastName: staff.lastName,
              email: staff.email,
              password: hashedPassword,
              role: staff.role.toLowerCase().includes('comité') || staff.role.toLowerCase().includes('admin') ? 'ADMIN' : 'STAFF',
              passwordConfigured: false,
            },
          })

          await ctx.db.staffMember.update({
            where: { id: staff.id },
            data: { userId: user.id },
          })
        }
      }

      // Reset password on User record
      const tempPassword = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      await ctx.db.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordConfigured: false,
        },
      })

      // Generate a setup token (no time expiration)
      const token = jwt.sign(
        { userId: user.id, email: user.email, action: 'setup-password' },
        process.env.JWT_SECRET!
      )

      console.log(`\n========================================================================\n[STAFF PASSWORD RESET] Setup password link for ${staff.firstName} ${staff.lastName} (${user.email}):\nhttps://s4s-connect.students4students.ch/setup-password?token=${token}\n========================================================================\n`)

      staffsEmitter.emit('updated')
      return {
        staffId: staff.id,
        userId: user.id,
        name: `${staff.firstName} ${staff.lastName}`,
        email: user.email,
        setupUrl: `https://s4s-connect.students4students.ch/setup-password?token=${token}`,
      }
    }),

  sendPasswordResetEmail: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const staff = await ctx.db.staffMember.findUniqueOrThrow({
        where: { id: input.id },
        include: { user: true },
      })

      let user = staff.user
      if (!user && staff.email) {
        user = await ctx.db.user.findUnique({ where: { email: staff.email } })
      }

      if (!user || !user.email) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Aucun compte utilisateur ou adresse email valide associé à ce membre du staff.',
        })
      }

      const tempPassword = crypto.randomUUID()
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      await ctx.db.user.update({
        where: { id: user.id },
        data: { password: hashedPassword, passwordConfigured: false },
      })

      const token = jwt.sign(
        { userId: user.id, email: user.email, action: 'setup-password' },
        process.env.JWT_SECRET!
      )

      const setupUrl = `https://s4s-connect.students4students.ch/setup-password?token=${token}`

      await sendPasswordReset({
        email: user.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        setupUrl,
      })

      staffsEmitter.emit('updated')
      return { success: true }
    }),

  trigger: publicProcedure.mutation(async () => {
    staffsEmitter.emit('updated')
    return { success: true }
  }),

  onUpdated: publicProcedure.subscription(async function* ({ signal }) {
    for await (const _ of on(staffsEmitter, 'updated', { signal })) {
      yield { updated: true }
    }
  }),
});
