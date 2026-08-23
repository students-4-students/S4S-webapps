import { useState } from 'react'
import IncidentList from '../components/IncidentList'
import CreateIncidentModal from '../components/CreateIncidentModal'
import StaffSummary from '../components/StaffSummary'
import AvailableRoomsCard from '../components/AvailableRoomsCard'
import '../../styles/dashboard.css'

function Dashboard() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div
      className="dashboard"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        width: '100%',
        height: '100%',
        padding: '1rem 1.5rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Main Dashboard Grid */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          flex: 1,
          minHeight: 0,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Incidents */}
        <div style={{ width: '320px', height: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem', flexShrink: 0, minHeight: 0, overflow: 'hidden' }}>
          <IncidentList onNew={() => setShowForm(true)} />
        </div>

        {/* Right Column: Staff Numbers Summary & Available Rooms Wide Card */}
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '320px', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flexShrink: 0 }}>
            <StaffSummary />
          </div>
          <AvailableRoomsCard />
        </div>
      </div>

      {showForm && (
        <CreateIncidentModal onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

export default Dashboard
