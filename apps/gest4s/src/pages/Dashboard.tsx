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
