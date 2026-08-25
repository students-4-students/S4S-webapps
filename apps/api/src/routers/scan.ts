import { z } from 'zod'
import { router, publicProcedure } from '../trpc/trpc'
import { TRPCError } from '@trpc/server'

/** Try to extract a student user ID from raw QR content.
 *  Supports two formats:
 *  1. A plain UUID                               → used directly
 *  2. A setup-password URL with a JWT token      → userId decoded from payload
 */
function extractStudentId(raw: string): string {
  const trimmed = raw.trim()

  // Try to detect a JWT embedded in a URL: ?token=<header>.<payload>.<sig>
  const tokenMatch = trimmed.match(/[?&]token=([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*)/)
  if (tokenMatch) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokenMatch[1].split('.')[1], 'base64url').toString('utf-8')
      )
      if (payload?.userId) return payload.userId
    } catch {
      // fall through
    }
  }

  // Otherwise assume the raw content is the user ID
  return trimmed
}

export const scanRouter = router({
  /** Validate and record a QR scan at a given entrance (A or B). */
  scanStudent: publicProcedure
    .input(
      z.object({
        qrContent: z.string().min(1),
        entrance: z.enum(['A', 'B']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const studentId = extractStudentId(input.qrContent)

      const student = await ctx.db.user.findFirst({
        where: { id: studentId, role: 'PARTICIPANT' },
        include: { section: true },
      })

      if (!student) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Étudiant non trouvé' })
      }

      if (student.QRScannedAt) {
        return {
          status: 'ALREADY_SCANNED' as const,
          student,
          scannedAt: student.QRScannedAt,
        }
      }

      // Record the scan
      const updated = await ctx.db.user.update({
        where: { id: student.id },
        data: {
          QRScannedAt: new Date(),
          firstDayGroup: input.entrance,
        },
        include: { section: true },
      })

      return {
        status: 'OK' as const,
        student: updated,
        scannedAt: updated.QRScannedAt!,
      }
    }),

  /** Reset a student's scan status (admin tool). */
  resetScan: publicProcedure
    .input(z.object({ studentId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.db.user.update({
        where: { id: input.studentId, role: 'PARTICIPANT' },
        data: { QRScannedAt: null },
      })
      return { success: true }
    }),

  /** Global scan statistics. */
  stats: publicProcedure.query(async ({ ctx }) => {
    const [total, scanned, scannedA, scannedB, totalA, totalB] = await Promise.all([
      ctx.db.user.count({ where: { role: 'PARTICIPANT' } }),
      ctx.db.user.count({ where: { role: 'PARTICIPANT', QRScannedAt: { not: null } } }),
      ctx.db.user.count({ where: { role: 'PARTICIPANT', QRScannedAt: { not: null }, firstDayGroup: 'A' } }),
      ctx.db.user.count({ where: { role: 'PARTICIPANT', QRScannedAt: { not: null }, firstDayGroup: 'B' } }),
      ctx.db.user.count({ where: { role: 'PARTICIPANT', firstDayGroup: 'A' } }),
      ctx.db.user.count({ where: { role: 'PARTICIPANT', firstDayGroup: 'B' } }),
    ])
    return { total, scanned, scannedA, scannedB, totalA, totalB, pending: total - scanned }
  }),
})
