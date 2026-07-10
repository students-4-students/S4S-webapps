import { z } from 'zod'
import { router, protectedProcedure } from '../trpc/trpc'

export const staffsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const staffs = await ctx.db.staffMember.findMany({
      orderBy: { lastName: 'asc' },
      include: {
        speakerSlots: { select: { id: true, title: true } },
        assistantSlots: { select: { id: true, title: true } },
        rcSlots: { select: { id: true, title: true } },
      },
    });
    return staffs;
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
      return updated;
    }),

  assignToCourses: protectedProcedure
    .input(
      z.object({
        staffMemberId: z.string(),
        speakerSlotIds: z.array(z.string()),
        assistantSlotIds: z.array(z.string()),
        rcSlotIds: z.array(z.string()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      console.log(`[DEBUG] [StaffsRouter] Re-assigning course slots for staff member ${input.staffMemberId}`);
      
      // Unlink previous slots
      await ctx.db.scheduleSlot.updateMany({
        where: { speakerId: input.staffMemberId },
        data: { speakerId: null },
      });
      await ctx.db.scheduleSlot.updateMany({
        where: { assistantId: input.staffMemberId },
        data: { assistantId: null },
      });
      await ctx.db.scheduleSlot.updateMany({
        where: { rcId: input.staffMemberId },
        data: { rcId: null },
      });

      // Link new slots
      if (input.speakerSlotIds.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { id: { in: input.speakerSlotIds } },
          data: { speakerId: input.staffMemberId },
        });
      }
      if (input.assistantSlotIds.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { id: { in: input.assistantSlotIds } },
          data: { assistantId: input.staffMemberId },
        });
      }
      if (input.rcSlotIds.length > 0) {
        await ctx.db.scheduleSlot.updateMany({
          where: { id: { in: input.rcSlotIds } },
          data: { rcId: input.staffMemberId },
        });
      }

      console.log(`[DEBUG] [StaffsRouter] Re-assigned slots successfully`);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log(`[DEBUG] [StaffsRouter] Deleting staff member ${input.id}`);
      await ctx.db.staffMember.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
