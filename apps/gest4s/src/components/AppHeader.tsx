import { useLocation } from '@tanstack/react-router'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard' },
  { path: '/schedule', label: 'Planning' },
  { path: '/operations', label: 'Opérations' },
  { path: '/rooms', label: 'Salles' },
  { path: '/workshops', label: 'Workshops' },
  { path: '/staffs', label: 'Staff' },
  { path: '/students', label: 'Étudiants' },
  { path: '/incidents', label: 'Incidents' },
  { path: '/feedback', label: 'Sondages' },
  { path: '/scan', label: '📷 Scan' },
]

export function AppHeader() {
  const { pathname } = useLocation()

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
    }}>
      {/* Left: AGEPoly logo */}
      <img
        src='/agep.svg'
        alt='AGEPoly'
        style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
      />

      {/* Center: page title */}
      <h1 style={{
        margin: 0,
        fontSize: '1.15rem',
        fontWeight: 700,
        letterSpacing: '0.01em',
        color: '#1e293b',
        textAlign: 'center',
        flex: 1,
      }}>
        {NAV_ITEMS.find(item => item.path === pathname)?.label || ''}
      </h1>

      {/* Right: S4S logo */}
      <img
        src='/s4s-logo.svg'
        alt='Students 4 Students'
        style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
      />
    </header>
  )
}
