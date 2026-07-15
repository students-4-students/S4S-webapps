import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { AuthGuard } from '../components/AuthGuard'
import { useAuthStore } from '../store/auth'
import { useState } from 'react'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  const isSetupPassword = location.pathname === '/setup-password'

  if (isSetupPassword) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Outlet />
      </div>
    )
  }

  return (
    <AuthGuard>
      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="header-brand">
            <img className="brand-logo" src="/s4s-logo.svg" alt="S4S Connect Logo" />
            <span className="brand-name">S4S Connect</span>
          </div>
          
          <div className="user-profile">
            <div className="user-info" onClick={() => setMenuOpen(!menuOpen)}>
              <div className="user-avatar">
                {user?.firstName?.[0] || 'U'}
              </div>
              <div className="user-details">
                <span className="user-name">{user?.firstName} {user?.lastName}</span>
              </div>
            </div>

            {menuOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <strong>{user?.firstName} {user?.lastName}</strong>
                  <span className="dropdown-email">{user?.email}</span>
                </div>
                <button className="logout-btn" onClick={() => { logout(); setMenuOpen(false); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="app-main">
          <Outlet />
        </main>

        {/* Navigation Bar */}
        <nav className="bottom-nav">
          <Link to="/" className="nav-item" activeProps={{ className: 'active' }} activeOptions={{ exact: true }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="nav-label">Accueil</span>
          </Link>

          <Link to="/schedule" className="nav-item" activeProps={{ className: 'active' }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="nav-label">Horaire</span>
          </Link>

          <Link to={"/map" as any} className="nav-item" activeProps={{ className: 'active' }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            <span className="nav-label">Plan</span>
          </Link>

          <Link to={"/drive" as any} className="nav-item" activeProps={{ className: 'active' }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="nav-label">Drive</span>
          </Link>

          <Link to={"/workshops" as any} className="nav-item" activeProps={{ className: 'active' }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="nav-label">Ateliers</span>
          </Link>

          <Link to={"/feedback" as any} className="nav-item" activeProps={{ className: 'active' }}>
            <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="nav-label">Feedback</span>
          </Link>
        </nav>
      </div>
    </AuthGuard>
  )
}
