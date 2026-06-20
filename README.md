# s4s-apps

Monorepo for the S4S (commission de l'AGEPoly )

## Apps

| App | Description | Port |
|-----|-------------|------|
| `apps/api` | NestJS + tRPC backend with Prisma ORM | `3000` |
| `apps/gest4s` | React admin dashboard for staff (incident management, scheduling) | `5173` |
| `apps/s4s-connect` | React participant-facing app with live map | `5174` |

## Packages

| Package | Description |
|---------|-------------|
| `packages/types` | Shared Zod schemas and TypeScript types used across apps |

## Tech stack

- **Runtime**: [Bun](https://bun.sh)
- **API**: NestJS, tRPC, Prisma, PostgreSQL (PostGIS), Valkey (Redis-compatible), MinIO
- **Frontend**: React 19, Vite, tRPC client, TanStack Query, Zustand
- **Infra**: Docker Compose for local services

## Project structure

```
s4s-apps/
├── apps/
│   ├── api/                  # Backend
│   │   ├── prisma/           # Database schema & migrations
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── lib/          # Shared utilities (db client, …)
│   │       ├── routers/      # tRPC routers (auth, incidents, …)
│   │       └── trpc/         # tRPC setup, context, NestJS controller
│   ├── gest4s/               # Staff dashboard
│   │   └── src/
│   │       ├── components/   # Reusable UI components
│   │       ├── pages/        # Route-level pages
│   │       └── store/        # Zustand stores
│   └── s4s-connect/          # Participant app
│       └── src/
│           ├── components/
│           ├── pages/
│           └── store/
├── infra/
│   ├── docker-compose.dev.yml  # Local services (Postgres, Valkey, MinIO)
│   └── .env.example
└── packages/
    └── types/                # Shared types & Zod schemas
```

## First-time setup

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com) & Docker Compose

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

```bash
# Infrastructure (Postgres, MinIO credentials)
cp infra/.env.example infra/.env

# API
cp apps/api/.env.example apps/api/.env
```

Fill in the required values:

- `JWT_SECRET` — required; generate one with `openssl rand -hex 32`
- `MINIO_SECRET_KEY` — required; choose any password for the local MinIO instance
- `POSTGRES_PASSWORD` — optional; defaults to `localdev`, change if needed (keep in sync between both files)

### 3. Start infrastructure services

```bash
bun run infra:up
```

This starts PostgreSQL (PostGIS), Valkey, and MinIO via Docker.

### 4. Run database migrations and seed

```bash
cd apps/api
bun run db:migrate   # applies all Prisma migrations
bun run db:generate  # generates the Prisma client (required before seeding)
bun run db:seed      # seeds initial data
```

The seed creates one admin user you can log in with immediately:

| Field | Value |
|-------|-------|
| Email | `admin@s4s.local` |
| Password | `admin1234` |
| Role | `ADMIN` |

The seed is idempotent — re-running it updates the password without creating duplicates.

### 6. Start all apps

From the repo root:

```bash
bun run dev
```

This starts the API, gest4s, and s4s-connect in parallel.

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| gest4s (frontend) | http://localhost:5173 |
| s4s-connect (frontend) | http://localhost:5174 |
| MinIO console | http://localhost:9001 |

## Common commands

```bash
bun run dev           # Start all apps in watch mode
bun run build         # Build all apps
bun run typecheck     # Type-check all packages

bun run infra:up      # Start Docker services
bun run infra:down    # Stop Docker services

# From apps/api:
bun run db:migrate    # Run pending migrations
bun run db:generate   # Regenerate Prisma client after schema changes
bun run db:studio     # Open Prisma Studio (database browser)
bun run db:seed       # Re-seed the database
```
