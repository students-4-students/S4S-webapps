import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from './routers'
import { createContext } from './trpc/context'

const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    const url = new URL(req.url)

    if (url.pathname.startsWith('/trpc')) {
      return fetchRequestHandler({
        endpoint: '/trpc',
        req,
        router: appRouter,
        createContext: () => createContext(req),
      })
    }

    return new Response('Not found', { status: 404 })
  },
})

console.log(`API running on http://localhost:${server.port}`)