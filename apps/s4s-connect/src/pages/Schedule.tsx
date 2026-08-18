import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] // 12 hours from 08:00 to 20:00
const HOUR_HEIGHT = 80
const START_HOUR = 8

// Format time: "08:30"
const formatTime = (dateInput: Date | string) => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

// Check if currently happening
const isCurrentlyHappening = (start: Date | string, end: Date | string) => {
  const now = new Date()
  const startTime = typeof start === 'string' ? new Date(start) : start
  const endTime = typeof end === 'string' ? new Date(end) : end
  return now >= startTime && now <= endTime
}

const getLocalDateString = (dateInput: Date | string) => {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDayFullLabel = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const label = date.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.replace(/^\w/, (c) => c.toUpperCase())
}

// Calculate absolute styling (top, height) for event placement in a 08:00 - 20:00 timeline
const calculateCardStyle = (startTime: Date | string, endTime: Date | string) => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime

  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()

  const timelineStartMin = START_HOUR * 60 // 480 min (08:00)
  const timelineEndMin = 20 * 60 // 1200 min (20:00)

  // Clamp coordinates to the 08:00 - 20:00 range
  const clampedStartMin = Math.max(timelineStartMin, Math.min(timelineEndMin, startMin))
  const clampedEndMin = Math.max(timelineStartMin, Math.min(timelineEndMin, endMin))

  const top = ((clampedStartMin - timelineStartMin) / 60) * HOUR_HEIGHT
  const height = ((clampedEndMin - clampedStartMin) / 60) * HOUR_HEIGHT

  return {
    top: `${top}px`,
    height: `${Math.max(38, height)}px`, // minimum height of 38px to keep cards legible
  }
}

const FALLBACK_DATES = [
  '2026-08-26',
  '2026-08-27',
  '2026-08-28',
  '2026-08-29',
  '2026-08-31',
  '2026-09-01',
  '2026-09-02',
  '2026-09-03',
]

export default function Schedule() {
  const { data: slots, isLoading: loadingSlots, error: errorSlots } = trpc.schedules.list.useQuery()
  const { data: me } = trpc.auth.me.useQuery()

  // 1. Determine list of dates
  const finalDates = useMemo(() => {
    if (!slots || slots.length === 0) return FALLBACK_DATES
    const dateStrings = Array.from(new Set(slots.map((s) => getLocalDateString(s.startTime))))
    return dateStrings.sort()
  }, [slots])

  const DAYS_DATA = useMemo(() => {
    return finalDates.map((dateStr) => {
      const fullLabel = formatDayFullLabel(dateStr)
      const parts = fullLabel.split(' ')
      return {
        dateStr,
        title: `${parts[0]} ${parts[1] || ''}`,
        subtitle: parts.slice(2).join(' '),
      }
    })
  }, [finalDates])

  // 2. Filter slots for a specific date, user's section & group (A/B)
  const slotsForDate = (dateStr: string) => {
    if (!slots) return []
    const userSectionId = me?.sectionId
    const userGroup = me?.firstDayGroup

    return slots
      .filter((slot) => {
        if (getLocalDateString(slot.startTime) !== dateStr) return false
        
        // Filter by section if specified
        if (userSectionId && slot.sectionId && slot.sectionId !== userSectionId) {
          return false
        }
        
        // Filter by targetGroup (Groupe A or B) if specified on the slot
        if (slot.targetGroup) {
          if (!userGroup || userGroup !== slot.targetGroup) {
            return false
          }
        }
        
        return true
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  // Compute side-by-side positioning (left, width) for overlapping slots in a day column
  const computeOverlappingLayout = (daySlots: any[]) => {
    if (!daySlots || daySlots.length === 0) return new Map<string, { left: string; width: string }>()

    const parsed = daySlots.map((slot) => {
      const s = typeof slot.startTime === 'string' ? new Date(slot.startTime) : slot.startTime
      const e = typeof slot.endTime === 'string' ? new Date(slot.endTime) : slot.endTime
      return {
        id: slot.id,
        startMin: s.getHours() * 60 + s.getMinutes(),
        endMin: e.getHours() * 60 + e.getMinutes(),
      }
    })

    const clusters: typeof parsed[] = []
    let currentCluster: typeof parsed = []
    let clusterEnd = -1

    const sorted = [...parsed].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

    for (const item of sorted) {
      if (currentCluster.length === 0) {
        currentCluster.push(item)
        clusterEnd = item.endMin
      } else if (item.startMin < clusterEnd) {
        currentCluster.push(item)
        if (item.endMin > clusterEnd) {
          clusterEnd = item.endMin
        }
      } else {
        clusters.push(currentCluster)
        currentCluster = [item]
        clusterEnd = item.endMin
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster)
    }

    const layoutMap = new Map<string, { left: string; width: string }>()

    for (const cluster of clusters) {
      const columns: (typeof parsed)[] = []
      const itemCol = new Map<string, number>()

      for (const item of cluster) {
        let placed = false
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const lastInCol = columns[colIdx][columns[colIdx].length - 1]
          if (lastInCol.endMin <= item.startMin) {
            columns[colIdx].push(item)
            itemCol.set(item.id, colIdx)
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([item])
          itemCol.set(item.id, columns.length - 1)
        }
      }

      const totalCols = columns.length
      for (const item of cluster) {
        const colIdx = itemCol.get(item.id) || 0
        const widthPct = (100 / totalCols).toFixed(2)
        const leftPct = ((colIdx * 100) / totalCols).toFixed(2)
        layoutMap.set(item.id, {
          left: `calc(${leftPct}% + ${colIdx > 0 ? 2 : 0}px)`,
          width: `calc(${widthPct}% - 4px)`,
        })
      }
    }

    return layoutMap
  }

  if (loadingSlots) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-subtitle"></div>
        </div>
        <div className="skeleton-tabs">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="skeleton skeleton-tab"></div>
          ))}
        </div>
        <div className="slots-list">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton skeleton-card"></div>
          ))}
        </div>
      </div>
    )
  }

  if (errorSlots) {
    return (
      <div className="error-container">
        <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Impossible de charger le planning</h3>
        <p>{errorSlots.message}</p>
      </div>
    )
  }

  return (
    <div className="schedule-container">
      {/* Dynamic Header */}
      <div className="schedule-header">
        <h1>Horaire</h1>
      </div>

      {/* Calendar Timeline Grid */}
      <div className="calendar-container">
        <div
          className="calendar-grid"
          style={{ gridTemplateColumns: `80px repeat(${DAYS_DATA.length}, 240px)` }}
        >
          {/* Top-left corner spacer */}
          <div className="corner-header"></div>

          {/* Day Headers (Sticky top) */}
          {DAYS_DATA.map((day) => (
            <div className="day-header" key={day.dateStr}>
              <span className="day-title">{day.title}</span>
              <span className="day-subtitle">{day.subtitle}</span>
            </div>
          ))}

          {/* Left Time Column (Sticky left) */}
          <div className="time-column-grid">
            {HOURS.map((hour) => (
              <div className="time-grid-cell" key={hour}>
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day Columns (Contain background cells and absolute slots) */}
          {DAYS_DATA.map((day) => {
            const daySlots = slotsForDate(day.dateStr)
            const layoutMap = computeOverlappingLayout(daySlots)
            return (
              <div className="day-body-column" key={day.dateStr}>
                {/* Background Hour Lines */}
                {HOURS.map((hour) => (
                  <div className="hour-grid-cell" key={hour}></div>
                ))}

                {/* Overlay Events absolute container */}
                <div className="cards-container">
                  {daySlots.map((slot) => {
                    const cardStyle = calculateCardStyle(slot.startTime, slot.endTime)
                    const sideStyle = layoutMap.get(slot.id)
                    const combinedStyle = sideStyle
                      ? { ...cardStyle, left: sideStyle.left, width: sideStyle.width, right: 'auto' }
                      : cardStyle
                    const isLive = isCurrentlyHappening(slot.startTime, slot.endTime)
                    const typeClass = slot.type.toLowerCase() // lecture, exercise, workshop, activity, free, special, meal

                    return (
                      <div
                        key={slot.id}
                        className={`slot-card-absolute ${typeClass} ${isLive ? 'live-slot' : ''}`}
                        style={combinedStyle}
                        title={`${slot.title}\n🕒 ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}\n${slot.description || ''}`}
                      >
                        <div className="card-time">
                          🕒 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          {isLive && <span className="live-badge-dot"></span>}
                        </div>

                        <div className="card-title">{slot.title}</div>

                        <div className="card-meta-row">
                          {slot.location && (
                            <Link
                              to="/map"
                              search={{ places: slot.location.split(' ')[0] } as any}
                              className="card-meta-item location-link"
                              style={{ color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                              title="Voir sur le plan"
                            >
                              📍 {slot.location}
                            </Link>
                          )}
                          {(slot.speaker || slot.assistant || slot.rc) && (
                            <span
                              className="card-meta-item"
                              title={[
                                slot.speaker && `Prof: ${slot.speaker.firstName} ${slot.speaker.lastName}`,
                                slot.assistant && `Asst: ${slot.assistant.firstName} ${slot.assistant.lastName}`,
                                slot.rc && `RC: ${slot.rc.firstName} ${slot.rc.lastName}`
                              ].filter(Boolean).join('\n')}
                            >
                              {[
                                slot.speaker && slot.speaker.lastName,
                                slot.assistant && slot.assistant.lastName,
                                slot.rc && slot.rc.lastName
                              ].filter(Boolean)[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
