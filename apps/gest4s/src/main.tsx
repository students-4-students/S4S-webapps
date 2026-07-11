import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { useAuthStore } from './store/auth'
import { trpc, makeTrpcClient } from './trpc'
import App from './App'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED') {
        useAuthStore.getState().logout()
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED') {
        useAuthStore.getState().logout()
      }
    },
  }),
})
const trpcClient = makeTrpcClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </React.StrictMode>
)