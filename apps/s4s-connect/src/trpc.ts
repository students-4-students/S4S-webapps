import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink, httpSubscriptionLink, splitLink } from '@trpc/client'
import type { AppRouter } from '../../api/src/routers'

export const trpc = createTRPCReact<AppRouter>()

function getHeaders() {
  const token = localStorage.getItem('s4s-auth')
  if (!token) return {}
  try {
    const parsed = JSON.parse(token)
    return parsed.state?.token
      ? { authorization: `Bearer ${parsed.state.token}` }
      : {}
  } catch {
    return {}
  }
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: httpSubscriptionLink({
          url: 'http://localhost:3001/trpc',
          connectionParams: getHeaders,
        }),
        false: httpBatchLink({
          url: 'http://localhost:3001/trpc',
          headers: getHeaders,
        }),
      }),
    ],
  })
}