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
          url: `${import.meta.env.VITE_API_BASE_URL || '/api'}/trpc`,
          connectionParams: getHeaders,
        }),
        false: httpBatchLink({
          url: `${import.meta.env.VITE_API_BASE_URL || '/api'}/trpc`,
          headers: getHeaders,
        }),
      }),
    ],
  })
}