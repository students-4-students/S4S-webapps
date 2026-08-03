import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthGuard } from '../components/AuthGuard'
import { AppHeader } from '../components/AppHeader'

export const Route = createRootRoute({
  component: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />
      <AuthGuard>
        <div style={{ paddingTop: '64px', boxSizing: 'border-box', width: '100%', height: '100%' }}>
          <Outlet />
        </div>
      </AuthGuard>
    </div>
  ),
})
