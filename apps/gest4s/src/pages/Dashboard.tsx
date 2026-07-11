import { useState } from 'react'
import IncidentList from '../components/IncidentList'
import CreateIncidentModal from '../components/CreateIncidentModal'
import '../../styles/dashboard.css'
import StaffSummary from '../components/StaffSummary'

function Dashboard() {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className='dashboard'>
      <IncidentList onNew={() => setShowForm(true)} />
      <StaffSummary />
      {showForm && (
        <CreateIncidentModal onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

export default Dashboard
