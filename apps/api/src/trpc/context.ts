import { db } from '../lib/db'
import jwt from 'jsonwebtoken'

export function createContext(opts?: any) {
  const req = opts?.req || opts
  const authHeader = req?.headers?.authorization || (typeof req?.headers?.get === 'function' ? req.headers.get('authorization') : undefined)
  const token = typeof authHeader === 'string' ? authHeader.split(' ')[1] : undefined
  let user: { id: string; role: string; email?: string; firstName?: string; lastName?: string } | null = null

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as any
    } catch {
      user = null
    }
  }

  return { db, user }
}

export type Context = Awaited<ReturnType<typeof createContext>>

