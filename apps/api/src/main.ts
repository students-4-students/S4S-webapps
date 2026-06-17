import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers'
import { createContext } from './trpc/context'

const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url)
    const origin = req.headers.get('origin') ?? ''
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]

    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname.startsWith('/trpc')) {
      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        req,
        router: appRouter,
        createContext: () => createContext(req),
      })

      const newHeaders = new Headers(response.headers)
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v))

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      })
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`API running on http://localhost:${server.port}`)