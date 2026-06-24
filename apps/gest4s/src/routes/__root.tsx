import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthGuard } from '../components/AuthGuard'

export const Route = createRootRoute({
  component: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <AuthGuard>
        <Outlet />
      </AuthGuard>
      <img src='/agep.svg' style={{ width: '10vw', position: 'absolute', top: 10, left: 10 }} />
      <img src='/s4s-logo.svg' style={{ width: '5vw', position: 'absolute', top: 0, right: 10 }} />
    </div>
  ),
})
