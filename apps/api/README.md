# Backend API

## 🛠️ How to Add New tRPC Routers and Routes

To add new API routes to the backend, follow these steps:

### Step 1: Ensure DB Model Exists
Verify that your database model is defined in the Prisma schema:
* Open [schema.prisma](./prisma/schema.prisma) and define/modify your model if needed.
* Run Prisma migrations if schema changes were made.

### Step 2: Create a New Router File
Create a new file in `apps/api/src/routers/`. For example, `schedules.ts`:
```typescript
import { z } from 'zod'
import { router, protectedProcedure, publicProcedure } from '../trpc/trpc'

export const schedulesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.scheduleSlot.findMany()
  }),
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      type: z.enum(['LECTURE', 'EXERCISE', 'WORKSHOP', 'ACTIVITY', 'FREE']),
      startTime: z.coerce.date(),
      endTime: z.coerce.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.scheduleSlot.create({ data: input })
    }),
})
```

### Step 3: Register Your Router
Register your new router in [index.ts](./src/routers/index.ts):
```typescript
import { schedulesRouter } from './schedules'

export const appRouter = router({
  auth: authRouter,
  incidents: incidentsRouter,
  staffs: staffsRouter,
  schedules: schedulesRouter, // <-- Add here
})
```

### Step 4: Use in Frontend
Use the automatically typed client in `apps/gest4s` (or `apps/s4s-connect`):
```typescript
import { trpc } from '../trpc'

// Querying data:
const { data, isLoading } = trpc.schedules.list.useQuery()

// Mutating data:
const createMutation = trpc.schedules.create.useMutation()
createMutation.mutate({ title: 'New Class', ... })
```