import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import bcrypt from 'bcrypt'


const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

const hashedPassword = await bcrypt.hash('admin1234', 10)

const admin = await db.user.upsert({
  where: { email: 'admin@s4s.local' },
  update: { password: hashedPassword },
  create: {
    email: 'admin@s4s.local',
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'S4S',
    role: 'ADMIN',
  },
})