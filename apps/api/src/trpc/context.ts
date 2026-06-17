import { db } from '../lib/db'
import jwt from 'jsonwebtoken'

export function createContext(req: Request) {
  const token = req.headers.get('authorization')?.split(' ')[1]
  let user: { id: string; role: string } | null = null

  if (token) {
    try {
      user = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string }
    } catch {
      user = null
    }
  }

  return { db, user }
}

export type Context = ReturnType<typeof createContext>
