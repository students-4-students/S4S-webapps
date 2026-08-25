import { EventEmitter, on } from 'events'
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, adminProcedure } from '../trpc/trpc'

export const feedbackEmitter = new EventEmitter()
feedbackEmitter.setMaxListeners(100)

const QuestionTypeEnum = z.enum(['LIKERT_5', 'OPEN_TEXT', 'SINGLE_CHOICE', 'MULTIPLE'])

const QuestionOptionInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
})

const QuestionInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  type: QuestionTypeEnum,
  required: z.boolean().default(true),
  options: z.array(QuestionOptionInput).optional(),
})

const PageInput = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  questions: z.array(QuestionInput),
})

export const feedbackRouter = router({
  // Real-time subscription for live survey updates / responses
  onUpdated: protectedProcedure.subscription(async function* () {
    for await (const [event] of on(feedbackEmitter, 'updated')) {
      yield event
    }
  }),

  // List all surveys (for users, active ones or assigned ones; for admin all)
  list: protectedProcedure.query(async ({ ctx }) => {
    const isAdmin = ctx.user.role === 'ADMIN'
    const now = new Date()
    
    return ctx.db.survey.findMany({
      where: isAdmin
        ? undefined
        : {
            active: true,
            OR: [
              { availableAt: null },
              { availableAt: { lte: now } },
            ],
          },
      orderBy: { createdAt: 'desc' },
      include: {
        pages: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        responses: {
          where: isAdmin ? undefined : { userId: ctx.user.id },
          select: {
            id: true,
            userId: true,
            createdAt: true,
          },
        },
        _count: {
          select: { responses: true },
        },
      },
    })
  }),

  // Get a single survey details with questions & user response status
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.user.role === 'ADMIN'
      const survey = await ctx.db.survey.findUnique({
        where: { id: input.id },
        include: {
          pages: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  options: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
          responses: {
            where: { userId: ctx.user.id },
            include: {
              answers: true,
            },
          },
          _count: {
            select: { responses: true },
          },
        },
      })

      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sondage introuvable' })
      }

      if (!isAdmin) {
        if (!survey.active) {
          throw new TRPCError({ code: 'FORBIDDEN', message: "Ce sondage n'est pas actif." })
        }
        if (survey.availableAt && new Date(survey.availableAt) > new Date()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Ce sondage sera disponible le ${new Date(survey.availableAt).toLocaleString('fr-FR')}.`,
          })
        }
      }

      return survey
    }),

  // Get survey analytics (Admin only)
  getAnalytics: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const survey = await ctx.db.survey.findUnique({
        where: { id: input.id },
        include: {
          pages: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  options: {
                    orderBy: { order: 'asc' },
                  },
                  answers: {
                    include: {
                      option: true,
                      response: {
                        include: {
                          user: {
                            select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              email: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          _count: {
            select: { responses: true },
          },
        },
      })

      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sondage introuvable' })
      }

      return survey
    }),

  // Create a multi-page survey (Admin only)
  create: adminProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        active: z.boolean().default(true),
        availableAt: z.string().optional().nullable(),
        pages: z.array(PageInput).min(1, 'Le sondage doit comporter au moins une page'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const survey = await ctx.db.survey.create({
        data: {
          title: input.title,
          description: input.description,
          active: input.active,
          availableAt: input.availableAt ? new Date(input.availableAt) : null,
          pages: {
            create: input.pages.map((page, pageIdx) => ({
              title: page.title,
              description: page.description,
              order: pageIdx,
              questions: {
                create: page.questions.map((q, qIdx) => ({
                  title: q.title,
                  description: q.description,
                  type: q.type as any,
                  required: q.required,
                  order: qIdx,
                  options: q.options && q.options.length > 0 ? {
                    create: q.options.map((opt, optIdx) => ({
                      label: opt.label,
                      order: optIdx,
                    })),
                  } : undefined,
                })),
              },
            })),
          },
        },
        include: {
          pages: {
            include: {
              questions: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      })

      feedbackEmitter.emit('updated', { type: 'CREATED', surveyId: survey.id })
      return survey
    }),

  // Update a survey (Admin only)
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        active: z.boolean(),
        availableAt: z.string().optional().nullable(),
        pages: z.array(PageInput).min(1, 'Le sondage doit comporter au moins une page'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Delete existing pages & recreate to cleanly update nested structure
      await ctx.db.surveyPage.deleteMany({
        where: { surveyId: input.id },
      })

      const updated = await ctx.db.survey.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
          active: input.active,
          availableAt: input.availableAt ? new Date(input.availableAt) : null,
          pages: {
            create: input.pages.map((page, pageIdx) => ({
              title: page.title,
              description: page.description,
              order: pageIdx,
              questions: {
                create: page.questions.map((q, qIdx) => ({
                  title: q.title,
                  description: q.description,
                  type: q.type as any,
                  required: q.required,
                  order: qIdx,
                  options: q.options && q.options.length > 0 ? {
                    create: q.options.map((opt, optIdx) => ({
                      label: opt.label,
                      order: optIdx,
                    })),
                  } : undefined,
                })),
              },
            })),
          },
        },
        include: {
          pages: {
            include: {
              questions: {
                include: {
                  options: true,
                },
              },
            },
          },
        },
      })

      feedbackEmitter.emit('updated', { type: 'UPDATED', surveyId: updated.id })
      return updated
    }),

  // Toggle active status
  toggleActive: adminProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const survey = await ctx.db.survey.update({
        where: { id: input.id },
        data: { active: input.active },
      })
      feedbackEmitter.emit('updated', { type: 'TOGGLED', surveyId: survey.id })
      return survey
    }),

  // Delete survey
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.survey.delete({
        where: { id: input.id },
      })
      feedbackEmitter.emit('updated', { type: 'DELETED', surveyId: input.id })
      return { success: true }
    }),

  // Submit survey responses (User/Participant)
  submitResponse: protectedProcedure
    .input(
      z.object({
        surveyId: z.string(),
        answers: z.array(
          z.object({
            questionId: z.string(),
            optionId: z.string().optional().nullable(),
            textAnswer: z.string().optional().nullable(),
            // For multiple choice answers, list of optionIds
            optionIds: z.array(z.string()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id
      const isAdmin = ctx.user.role === 'ADMIN'

      const survey = await ctx.db.survey.findUnique({
        where: { id: input.surveyId },
      })

      if (!survey) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Sondage introuvable' })
      }

      if (!isAdmin) {
        if (!survey.active) {
          throw new TRPCError({ code: 'FORBIDDEN', message: "Ce sondage n'est pas actif." })
        }
        if (survey.availableAt && new Date(survey.availableAt) > new Date()) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Ce sondage sera disponible le ${new Date(survey.availableAt).toLocaleString('fr-FR')}.`,
          })
        }
      }

      // Check existing response
      const existing = await ctx.db.surveyResponse.findUnique({
        where: {
          surveyId_userId: {
            surveyId: input.surveyId,
            userId,
          },
        },
      })

      if (existing) {
        // Delete previous response to overwrite cleanly
        await ctx.db.surveyResponse.delete({
          where: { id: existing.id },
        })
      }

      // Flatten answers array (since MULTIPLE can have array of optionIds)
      const answerCreates: Array<{ questionId: string; optionId?: string | null; textAnswer?: string | null }> = []

      for (const ans of input.answers) {
        if (ans.optionIds && ans.optionIds.length > 0) {
          for (const optId of ans.optionIds) {
            answerCreates.push({
              questionId: ans.questionId,
              optionId: optId,
              textAnswer: ans.textAnswer,
            })
          }
        } else {
          answerCreates.push({
            questionId: ans.questionId,
            optionId: ans.optionId,
            textAnswer: ans.textAnswer,
          })
        }
      }

      const response = await ctx.db.surveyResponse.create({
        data: {
          surveyId: input.surveyId,
          userId,
          answers: {
            create: answerCreates,
          },
        },
      })

      feedbackEmitter.emit('updated', { type: 'RESPONSE_SUBMITTED', surveyId: input.surveyId, userId })
      return response
    }),
})
