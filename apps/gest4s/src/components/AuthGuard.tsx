import { useLocation } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'
import { Login } from '../pages/Login'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const { pathname } = useLocation()

  // Pages accessible to STAFF + ADMIN (add future staff-only pages here)
  const STAFF_ROUTES = ['/scan']
  const isStaffRoute = STAFF_ROUTES.some((r) => pathname.startsWith(r))

  if (isStaffRoute) return <>{children}</>

  if (!token) return <Login />

  const role = user?.role ?? ''
  const allowed = isStaffRoute
    ? ['ADMIN', 'STAFF'].includes(role)
    : role === 'ADMIN'

  if (!allowed) {
    logout()
    return <Login />
  }

  return <>{children}</>
}