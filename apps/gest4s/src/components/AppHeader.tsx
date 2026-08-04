import { useLocation } from '@tanstack/react-router'

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/schedule': 'Planning',
  '/operations': 'Opérations',
  '/staffs': 'Staff',
  '/students': 'Étudiants',
  '/workshops': 'Workshops',
  '/incidents': 'Incidents',
  '/scan': '📷 Scanner QR',
}

function getTitle(pathname: string): string {
  // Exact match first
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
  // Prefix match (e.g. /incidents/123)
  const prefix = Object.keys(ROUTE_TITLES).find(
    (k) => k !== '/' && pathname.startsWith(k),
  )
  return prefix ? ROUTE_TITLES[prefix] : 'Gest4S'
}

export function AppHeader() {
  const { pathname } = useLocation()
  const title = getTitle(pathname)

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
      background: 'rgba(255,255,255,0.85)',
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
        {title}
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
