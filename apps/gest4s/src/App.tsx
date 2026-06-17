import { AuthGuard } from './components/AuthGuard'
import { useAuthStore } from './store/auth'

function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  return (
    <div style={{ padding: 32 }}>
      <p>Welcome, {user?.firstName} {user?.lastName}</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{user?.role}</p>
      <button onClick={logout} style={{ marginTop: 16 }}>Log out</button>
    </div>
  )
}

export default function App() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  )
}