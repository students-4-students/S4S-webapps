import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '../../api/src/routers'

export const trpc = createTRPCReact<AppRouter>()
export type RouterOutputs = inferRouterOutputs<AppRouter>

function getHeaders() {
  const raw = localStorage.getItem('s4s-auth')
  const token = raw ? JSON.parse(raw)?.state?.token : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: httpSubscriptionLink({
          url: 'http://localhost:3001/trpc',
          headers: getHeaders,
        }),
        false: httpBatchLink({
          url: 'http://localhost:3001/trpc',
          headers: getHeaders,
        }),
      }),
    ],
  })
}