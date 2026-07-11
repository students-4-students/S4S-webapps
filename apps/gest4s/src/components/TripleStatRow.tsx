interface TripleStatRowProps {
  title: string
  stats: {
    disponible: number
    occupe: number
    absent: number
  }
}

export function TripleStatRow({ title, stats }: TripleStatRowProps) {
  return (
    <div className="triple-stat-row">
      <div className="role-title">{title}</div>
      <div className="stat-columns">
        <div className="stat-column">
          <div className="stat-label">Disponible</div>
          <div className="stat-number">{stats.disponible || 0}</div>
        </div>
        <div className="stat-column">
          <div className="stat-label">Occupé(e)</div>
          <div className="stat-number">{stats.occupe || 0}</div>
        </div>
        <div className="stat-column">
          <div className="stat-label">Indisponible</div>
          <div className="stat-number">{stats.absent || 0}</div>
        </div>
      </div>
    </div>
  )
}
