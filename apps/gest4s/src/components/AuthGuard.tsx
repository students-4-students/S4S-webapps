import { useAuthStore } from '../store/auth'
import { Login } from '../pages/Login'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  if (!token) return <Login />
  if (user?.role === 'PARTICIPANT') {
    logout()
    return <Login />
  }
  return <>{children}</>
}