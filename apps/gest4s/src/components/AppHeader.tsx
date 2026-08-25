import { Link, useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '../store/auth'
import '../../styles/app.css'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/schedule', label: 'Planning' },
  { path: '/staffs', label: 'Staff' },
  { path: '/students', label: 'Étudiants' },
  { path: '/incidents', label: 'Incidents' },
]

export function AppHeader() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate({ to: '/' })
  }

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      gap: '12px',
    }}>
      {/* Left: AGEPoly logo */}
      <Link to='/' style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src='/agep.svg'
          alt='AGEPoly'
          style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
        />
      </Link>

      {/* Center: Navigation Menu */}
      <nav className='nav-menu'>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            activeOptions={{ exact: item.path === '/' }}
            className='nav-tab'
            activeProps={{ className: 'nav-tab active' }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right: S4S logo + User profile & Logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-purple-dark)' }}>
                {user.firstName} {user.lastName}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#6b7280', textTransform: 'capitalize' }}>
                {user.role.toLowerCase()}
              </span>
            </div>

            <button
              type='button'
              onClick={handleLogout}
              title='Déconnexion'
              style={{
                margin: 0,
                padding: '0.4rem 0.75rem',
                fontSize: '0.82rem',
                fontWeight: 500,
                borderRadius: '0.5rem',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#dc2626',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#dc2626'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'
                e.currentTarget.style.color = '#dc2626'
              }}
            >
              <span>Déconnexion</span>
            </button>
            <Link to='/' style={{ display: 'flex', alignItems: 'center' }}>
              <img
                src='/s4s-logo.svg'
                alt='Students 4 Students'
                style={{ height: '40px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}