import { useAuthStore } from '../store/auth'
import { Login } from '../pages/Login'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  if (!token) return <Login />
  return <>{children}</>
}