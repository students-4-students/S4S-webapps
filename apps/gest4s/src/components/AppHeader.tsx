import { Link } from '@tanstack/react-router'
import '../../styles/app.css'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/schedule', label: 'Planning' },
  { path: '/staffs', label: 'Staff' },
  { path: '/students', label: 'Étudiants' },
  { path: '/incidents', label: 'Incidents' },
]

export function AppHeader() {
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

      {/* Right: S4S logo */}
      <Link to='/' style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <img
          src='/s4s-logo.svg'
          alt='Students 4 Students'
          style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
        />
      </Link>
    </header>
  )
}