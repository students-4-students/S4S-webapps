import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../api/src/routers'

export const trpc = createTRPCReact<AppRouter>()

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: 'http://localhost:3001/trpc',
        headers() {
          const token = localStorage.getItem('s4s-auth')
          if (!token) return {}
          const parsed = JSON.parse(token)
          return parsed.state?.token
            ? { authorization: `Bearer ${parsed.state.token}` }
            : {}
        },
      }),
    ],
  })
}