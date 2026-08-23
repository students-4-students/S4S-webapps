import { z } from 'zod'
import { publicProcedure, router } from '../trpc/trpc'
import { EventEmitter, on } from 'events'

export const taskEmitter = new EventEmitter()
taskEmitter.setMaxListeners(100)

const taskCategorySchema = z.enum(['LOGISTIQUE', 'MATERIEL', 'ANIMATION', 'PEDAGOGIE', 'COMMUNICATION'])
const taskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

export const tasksRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.task.findMany({
      include: {
        assignments: {
          include: {
            staffMember: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, 'Le nom de la tâche est requis'),
        description: z.string().optional(),
        category: taskCategorySchema,
        startTime: z.coerce.date(),
        endTime: z.coerce.date(),
        location: z.string().optional(),
        roomId: z.string().optional().nullable(),
        status: taskStatusSchema.default('PENDING'),
        priority: prioritySchema.default('MEDIUM'),
        assignedStaffIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { assignedStaffIds, ...taskData } = input

      const task = await ctx.db.task.create({
        data: {
          ...taskData,
          assignments: assignedStaffIds?.length
            ? {
                create: assignedStaffIds.map((staffMemberId) => ({
                  staffMemberId,
                })),
              }
            : undefined,
        },
        include: {
          assignments: {
            include: {
              staffMember: true,
            },
          },
        },
      })

      taskEmitter.emit('updated', task)
      return task
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        category: taskCategorySchema.optional(),
        startTime: z.coerce.date().optional(),
        endTime: z.coerce.date().optional(),
        location: z.string().nullable().optional(),
        status: taskStatusSchema.optional(),
        priority: prioritySchema.optional(),
        assignedStaffIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, assignedStaffIds, ...taskData } = input

      if (assignedStaffIds !== undefined) {
        await ctx.db.taskAssignment.deleteMany({
          where: { taskId: id },
        })

        if (assignedStaffIds.length > 0) {
          await ctx.db.taskAssignment.createMany({
            data: assignedStaffIds.map((staffMemberId) => ({
              taskId: id,
              staffMemberId,
            })),
          })
        }
      }

      const task = await ctx.db.task.update({
        where: { id },
        data: taskData,
        include: {
          assignments: {
            include: {
              staffMember: true,
            },
          },
        },
      })

      taskEmitter.emit('updated', task)
      return task
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.task.delete({
        where: { id: input.id },
      })
      taskEmitter.emit('updated', null)
      return { success: true }
    }),

  onUpdated: publicProcedure.subscription(async function* ({ signal }) {
    for await (const [data] of on(taskEmitter, 'updated', { signal })) {
      yield data
    }
  }),
})
