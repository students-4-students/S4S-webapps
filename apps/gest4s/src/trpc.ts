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
          const raw = localStorage.getItem('s4s-auth')
          const token = raw ? JSON.parse(raw)?.state?.token : null
          return {
            'Content-Type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          }
        },
      }),
    ],
  })
}