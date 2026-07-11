interface StatDetail {
  label: string
  value: number
}

interface StatCardProps {
  title: string
  value: number
  details?: StatDetail[]
}

export function StatCard({ title, value, details }: StatCardProps) {
  return (
    <div className="stat-card">
      <h2 className="stat-title">{title}</h2>
      <p className="stat-value">{value}</p>

      {details && details.length > 0 && (
        <div className="stat-details">
          {details.map((item, index) => (
            <div key={index} className="stat-detail">
              <p className="stat-label">{item.label}</p>
              <p className="stat-number">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
