import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import IncidentList from '../components/IncidentList'
import CreateIncidentModal from '../components/CreateIncidentModal'
import StaffSummary from '../components/StaffSummary'
import '../../styles/dashboard.css'

function Dashboard() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '1rem', boxSizing: 'border-box' }}>
      {/* Navigation Buttons Row */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--s4s-bg-card)', padding: '0.75rem 1rem', borderRadius: 'var(--s4s-radius-lg)', border: '1px solid var(--s4s-border)', boxShadow: 'var(--s4s-shadow-sm)', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--s4s-text-primary)', marginRight: '0.5rem' }}>
          📌 Gest4S Menu:
        </span>
        <Link to="/operations" className="s4s-button s4s-button--primary s4s-button--sm">
          📊 Opérations & Pôles
        </Link>
        <Link to="/incidents" className="s4s-button s4s-button--secondary s4s-button--sm">
          🚨 Incidents
        </Link>
        <Link to="/staffs" className="s4s-button s4s-button--secondary s4s-button--sm">
          👥 Staffs
        </Link>
        <Link to="/students" className="s4s-button s4s-button--secondary s4s-button--sm">
          🎓 Étudiants
        </Link>
        <Link to="/workshops" className="s4s-button s4s-button--secondary s4s-button--sm">
          🎨 Workshops
        </Link>
        <Link to="/schedule" className="s4s-button s4s-button--secondary s4s-button--sm">
          📅 Planning
        </Link>
      </div>

      {/* Main Dashboard Grid */}
      <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
        <IncidentList onNew={() => setShowForm(true)} />
        <StaffSummary />
      </div>

      {showForm && (
        <CreateIncidentModal onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

export default Dashboard
