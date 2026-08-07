import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '../trpc/trpc'
import { TRPCError } from '@trpc/server'

export const driveRouter = router({
  // Lists all classes available to the logged-in user (admin sees all, staff/student filtered)
  listClasses: protectedProcedure.query(async ({ ctx }) => {
    const { user, db } = ctx

    if (user.role === 'ADMIN') {
      return db.class.findMany({
        orderBy: { name: 'asc' },
        include: {
          Section: true,
          readWriteStaff: { select: { id: true, firstName: true, lastName: true } },
          readOnlyStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }

    if (user.role === 'STAFF') {
      // Staff members have access if they are assigned to readWriteStaff or readOnlyStaff,
      // or if they are Speaker/Assistant/RC of a slot in that class (implied by design). Let's filter by:
      const staffMember = await db.staffMember.findUnique({
        where: { userId: user.id },
      })
      if (!staffMember) {
        return []
      }

      return db.class.findMany({
        where: {
          OR: [
            { readWriteStaff: { some: { id: staffMember.id } } },
            { readOnlyStaff: { some: { id: staffMember.id } } },
          ],
        },
        orderBy: { name: 'asc' },
        include: {
          Section: true,
          readWriteStaff: { select: { id: true, firstName: true, lastName: true } },
          readOnlyStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    }

    // Students (PARTICIPANT) only have access to classes linked with their section
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sectionId: true },
    })

    if (!dbUser || !dbUser.sectionId) {
      return []
    }

    return db.class.findMany({
      where: {
        Section: {
          some: {
            id: dbUser.sectionId,
          },
        },
      },
      orderBy: { name: 'asc' },
      include: {
        Section: true,
      },
    })
  }),

  // Get class contents (folders and files)
  getClassContents: protectedProcedure
    .input(z.object({ classId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { user, db } = ctx
      const { classId } = input

      // Verify access
      const access = await checkAccess(classId, user, db)
      if (!access.read) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Vous n'avez pas accès à ce Drive." })
      }

      const folders = await db.folder.findMany({
        where: { classId },
        orderBy: { name: 'asc' },
      })

      const now = new Date()

      // Users without write access (e.g. students or read-only staff) only see files available at or before now()
      const filesWhere = access.write
        ? { classId }
        : {
            classId,
            OR: [
              { availableAt: null },
              { availableAt: { lte: now } },
            ],
          }

      const files = await db.file.findMany({
        where: filesWhere,
        orderBy: { uploadedAt: 'desc' },
      })

      return {
        folders,
        files,
        canWrite: access.write,
      }
    }),

  // Admin class creation
  createClass: adminProcedure
    .input(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      sectionIds: z.array(z.string()),
      readWriteStaffIds: z.array(z.string()),
      readOnlyStaffIds: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { id, name, sectionIds, readWriteStaffIds, readOnlyStaffIds } = input

      const existing = await db.class.findUnique({ where: { id } })
      if (existing) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Une classe avec cet ID existe déjà.' })
      }

      return db.class.create({
        data: {
          id,
          name,
          Section: {
            connect: sectionIds.map(id => ({ id })),
          },
          readWriteStaff: {
            connect: readWriteStaffIds.map(id => ({ id })),
          },
          readOnlyStaff: {
            connect: readOnlyStaffIds.map(id => ({ id })),
          },
        },
        include: {
          Section: true,
          readWriteStaff: true,
          readOnlyStaff: true,
        },
      })
    }),

  // Admin class update
  updateClass: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1),
      sectionIds: z.array(z.string()),
      readWriteStaffIds: z.array(z.string()),
      readOnlyStaffIds: z.array(z.string()),
    }))
    .mutation(async ({ input, ctx }) => {
      const { db } = ctx
      const { id, name, sectionIds, readWriteStaffIds, readOnlyStaffIds } = input

      // Clear existing connections first by setting empty lists
      await db.class.update({
        where: { id },
        data: {
          Section: { set: [] },
          readWriteStaff: { set: [] },
          readOnlyStaff: { set: [] },
        },
      })

      return db.class.update({
        where: { id },
        data: {
          name,
          Section: {
            connect: sectionIds.map(id => ({ id })),
          },
          readWriteStaff: {
            connect: readWriteStaffIds.map(id => ({ id })),
          },
          readOnlyStaff: {
            connect: readOnlyStaffIds.map(id => ({ id })),
          },
        },
        include: {
          Section: true,
          readWriteStaff: true,
          readOnlyStaff: true,
        },
      })
    }),

  // Admin class deletion
  deleteClass: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.class.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),

  // Create folder inside a class
  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      classId: z.string(),
      parentId: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, db } = ctx
      const { name, classId, parentId } = input

      const access = await checkAccess(classId, user, db)
      if (!access.write) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Vous n'avez pas l'autorisation d'écriture sur ce Drive." })
      }

      return db.folder.create({
        data: {
          name,
          classId,
          parentId: parentId || null,
        },
      })
    }),

  // Delete folder
  deleteFolder: protectedProcedure
    .input(z.object({
      id: z.string(),
      classId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, db } = ctx
      const { id, classId } = input

      const access = await checkAccess(classId, user, db)
      if (!access.write) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Vous n'avez pas l'autorisation d'écriture sur ce Drive." })
      }

      await db.folder.delete({
        where: { id },
      })
      return { success: true }
    }),

  // Create metadata for a file with optional availableAt scheduled release time
  createFile: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      mimeType: z.string(),
      size: z.number(),
      classId: z.string(),
      folderId: z.string().optional().nullable(),
      content: z.string().optional(),
      availableAt: z.string().optional().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, db } = ctx
      const { name, mimeType, size, classId, folderId, content, availableAt } = input

      const access = await checkAccess(classId, user, db)
      if (!access.write) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Vous n'avez pas l'autorisation d'écriture sur ce Drive." })
      }

      let fileKey = `file-${Date.now()}`

      if (content) {
        try {
          const uploadsDir = path.resolve(process.cwd(), 'uploads')
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true })
          }

          const filename = `${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
          const filePath = path.join(uploadsDir, filename)

          // Decode base64 data URL or raw string content
          const base64Data = content.includes('base64,') ? content.split('base64,')[1] : content
          const buffer = Buffer.from(base64Data, 'base64')

          fs.writeFileSync(filePath, buffer)
          fileKey = `/uploads/${filename}`
        } catch (err) {
          console.error('Failed to save uploaded file to disk:', err)
          fileKey = content
        }
      }

      return db.file.create({
        data: {
          name,
          mimeType,
          size,
          bucket: 's4s-drive',
          key: fileKey,
          classId,
          folderId: folderId || null,
          availableAt: availableAt ? new Date(availableAt) : null,
        },
      })
    }),

  // Delete file
  deleteFile: protectedProcedure
    .input(z.object({
      id: z.string(),
      classId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { user, db } = ctx
      const { id, classId } = input

      const access = await checkAccess(classId, user, db)
      if (!access.write) {
        throw new TRPCError({ code: 'FORBIDDEN', message: "Vous n'avez pas l'autorisation d'écriture sur ce Drive." })
      }

      const file = await db.file.findUnique({ where: { id } })
      if (file && file.key.startsWith('/uploads/')) {
        const filePath = path.resolve(process.cwd(), file.key.replace(/^\//, ''))
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath)
          } catch (err) {
            console.error('Failed to delete file from disk:', err)
          }
        }
      }

      await db.file.delete({
        where: { id },
      })
      return { success: true }
    }),
})

// Helper function to check access level for a class
async function checkAccess(classId: string, user: any, db: any): Promise<{ read: boolean; write: boolean }> {
  if (user.role === 'ADMIN') {
    return { read: true, write: true }
  }

  // Get class and check config
  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      Section: true,
      readWriteStaff: true,
      readOnlyStaff: true,
    },
  })

  if (!cls) {
    return { read: false, write: false }
  }

  if (user.role === 'STAFF') {
    const staff = await db.staffMember.findUnique({
      where: { userId: user.id },
    })

    if (!staff) {
      return { read: false, write: false }
    }

    const hasWrite = cls.readWriteStaff.some((s: any) => s.id === staff.id)
    const hasRead = hasWrite || cls.readOnlyStaff.some((s: any) => s.id === staff.id)

    return { read: hasRead, write: hasWrite }
  }

  // User must be PARTICIPANT (Student)
  const student = await db.user.findUnique({
    where: { id: user.id },
    select: { sectionId: true },
  })

  if (!student || !student.sectionId) {
    return { read: false, write: false }
  }

  const isLinkedToSection = cls.Section.some((s: any) => s.id === student.sectionId)
  return { read: isLinkedToSection, write: false }
}
