import { trpc } from '../trpc'
import { StatCard } from './StatCard'
import { TripleStatRow } from './TripleStatRow'

function StaffSummary() {
  const utils = trpc.useUtils()
  const { data: staffs = [], isLoading } = trpc.staffs.list.useQuery()

  trpc.staffs.onUpdated.useSubscription(undefined, {
    onData: () => {
      console.log('[DEBUG] StaffSummary subscription event received! Invalidating staffs list.')
      utils.staffs.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] StaffSummary subscription error:', err)
    }
  })

  const getCountsForMultipleRoles = (roles: string[]) => {
    const filtered = staffs.filter((staff) => {
      if (!staff.role) return false
      const staffRoles = staff.role.split(',').map((r) => r.trim()).filter(Boolean)
      return staffRoles.some((r) => roles.includes(r))
    })

    return filtered.reduce(
      (acc, staff) => {
        if (staff.isPresent) {
          acc.total++
          if (staff.status === 'ACTIVE') acc.disponible++
          else if (staff.status === 'ON_LEAVE') acc.occupe++
          else acc.absent++
        } else {
          acc.absent++
        }
        return acc
      },
      { total: 0, disponible: 0, occupe: 0, absent: 0 }
    )
  }

  const getCounts = (roleFilter: string) => getCountsForMultipleRoles([roleFilter])

  // Calculate statistics
  const comiteStats = getCounts('Comité')
  const equipierStats = getCountsForMultipleRoles([
    'Équipier Logistique',
    'Équipier Catering',
    'Équipier IT',
    'Équipier Communication',
  ])
  const globalStats = getCountsForMultipleRoles([
    'Staff Logistique',
    'Staff Catering',
    'RC',
    'Speaker',
    'Assistant',
    'Staff Animation',
    'Staff Communication',
  ])
  const cateringStats = getCounts('Staff Catering')
  const logistiqueStats = getCounts('Staff Logistique')
  const animationStats = getCounts('Staff Animation')
  const communicationStats = getCountsForMultipleRoles(['Staff Communication', 'Staff Comm'])

  const rcStats = getCounts('RC')
  const speakerStats = getCounts('Speaker')
  const assistantStats = getCounts('Assistant')

  const renderStatCard = (title: string, stats: ReturnType<typeof getCountsForMultipleRoles>) => (
    <StatCard
      title={title}
      value={stats.total}
      details={[
        { label: 'Disponible', value: stats.disponible },
        { label: 'Occupé', value: stats.occupe },
        { label: 'Absent', value: stats.absent },
      ]}
    />
  )

  return (
    <div className='col stats-container-wrapper' style={{ flex: 1, backgroundColor: 'transparent', padding: 0 }}>
      {isLoading && <p>Chargement…</p>}
      {!isLoading && (
        <div className="stats-container">
          {/* First row - 3 cards */}
          <div className="stats-row first-row">
            {renderStatCard('Comité Présent', comiteStats)}
            {renderStatCard('Équipier Présent', equipierStats)}
            {renderStatCard('Staff Présent', globalStats)}
          </div>

          {/* Second row - 4 cards */}
          <div className="stats-row second-row">
            {renderStatCard('Staffs Catering', cateringStats)}
            {renderStatCard('Staffs Logistique', logistiqueStats)}
            {renderStatCard('Staffs Animation', animationStats)}
            {renderStatCard('Staffs Comm', communicationStats)}
          </div>

          {/* Third row - horizontal triple stats */}
          <div className="stats-row third-row">
            <TripleStatRow title="RC" stats={rcStats} />
            <TripleStatRow title="SPEAKER" stats={speakerStats} />
            <TripleStatRow title="ASSISTANT" stats={assistantStats} />
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffSummary