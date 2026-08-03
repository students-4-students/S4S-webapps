import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import CreateClassModal from '../components/CreateClassModal'
import EditClassModal from '../components/EditClassModal'
import CreateShiftModal from '../components/CreateShiftModal'
import EditShiftModal from '../components/EditShiftModal'
import '../../styles/schedule.css'
import '../../styles/dashboard.css'

type ViewType = 'section' | 'location' | 'person'

const DAYS = [
  { dateStr: '2026-08-26', label: 'Mer 26 août', fullLabel: 'Mercredi 26 août' },
  { dateStr: '2026-08-27', label: 'Jeu 27 août', fullLabel: 'Jeudi 27 août' },
  { dateStr: '2026-08-28', label: 'Ven 28 août', fullLabel: 'Vendredi 28 août' },
  { dateStr: '2026-08-29', label: 'Sam 29 août', fullLabel: 'Samedi 29 août' },
  { dateStr: '2026-08-31', label: 'Lun 31 août', fullLabel: 'Lundi 31 août' },
  { dateStr: '2026-09-01', label: 'Mar 1 sep', fullLabel: 'Mardi 1er septembre' },
  { dateStr: '2026-09-02', label: 'Mer 2 sep', fullLabel: 'Mercredi 2 septembre' },
  { dateStr: '2026-09-03', label: 'Jeu 3 sep', fullLabel: 'Jeudi 3 septembre' },
]

const SECTIONS = [
  'CMS',
  'POLYSI',
  'AR',
  'CH',
  'EL',
  'GC',
  'IN',
  'MA',
  'ME',
  'MT',
  'MX',
  'PH',
  'SC',
  'SIE',
  'SV'
]

// Timeline parameters
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19] // 12 hour rows representing intervals: 08:00 to 20:00
const HOUR_HEIGHT = 80 // pixels per hour row
const START_HOUR = 8

function Schedule() {
  const [viewType, setViewType] = useState<ViewType>('section')
  const [selectedEntityId, setSelectedEntityId] = useState<string>('')
  const [personSearchQuery, setPersonSearchQuery] = useState<string>('')
  const [isAutocompleteFocused, setIsAutocompleteFocused] = useState<boolean>(false)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false)
  const [showCreateShiftModal, setShowCreateShiftModal] = useState<boolean>(false)
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<any | null>(null)
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<any | null>(null)

  const { data: slots, isLoading: loadingSlots, error: errorSlots } = trpc.schedules.list.useQuery()
  const { data: staffs, isLoading: loadingStaffs } = trpc.staffs.list.useQuery()
  const { data: tasks = [] } = trpc.tasks.list.useQuery()
  const { data: shifts = [] } = trpc.shifts.list.useQuery()

  // Map operational tasks assigned to staff members so they show up on their schedule
  const mappedTaskSlots = useMemo(() => {
    if (!tasks || tasks.length === 0) return []
    const mapped: any[] = []

    tasks.forEach((task: any) => {
      if (task.assignments && task.assignments.length > 0) {
        task.assignments.forEach((assignment: any) => {
          mapped.push({
            id: `task-${task.id}-${assignment.staffMemberId}`,
            title: `[${task.category}] ${task.name}`,
            description: task.description || `Tâche Opérationnelle - Pôle ${task.category}`,
            startTime: task.startTime,
            endTime: task.endTime,
            location: task.location,
            type: 'SPECIAL' as const,
            isOperationalTask: true,
            category: task.category,
            assignedStaffId: assignment.staffMemberId,
            speakerId: assignment.staffMemberId,
            assistantId: null,
            rcId: null,
            section: null,
          })
        })
      }
    })
    return mapped
  }, [tasks])

  // Map staff shifts so they show up on personal schedule
  const mappedShiftSlots = useMemo(() => {
    if (!shifts || shifts.length === 0) return []
    return shifts.map((shift: any) => ({
      id: `shift-${shift.id}`,
      title: `[Shift: ${shift.type || 'Staff'}]${shift.notes ? ` ${shift.notes}` : ''}`,
      description: shift.notes || `Shift ${shift.type || ''}`,
      startTime: shift.startTime,
      endTime: shift.endTime,
      location: shift.location,
      type: 'SPECIAL' as const,
      isShift: true,
      shiftType: shift.type || 'Logistique',
      assignedStaffId: shift.staffMemberId,
      speakerId: null,
      assistantId: null,
      rcId: null,
      section: null,
      rawShift: shift,
    }))
  }, [shifts])

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  }

  const getSlotDateStr = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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

  if (loadingSlots || loadingStaffs) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement du planning...</p>
      </div>
    )
  }

  if (errorSlots) {
    return (
      <div className="loading-container">
        <p style={{ color: '#d86664' }}>Erreur: {errorSlots.message}</p>
        <Link to="/" className="back-btn">←</Link>
      </div>
    )
  }

  const safeSlots = slots || []

  // Populate sections or locations for dropdown
  let dropdownEntities: { id: string; label: string }[] = []

  if (viewType === 'section') {
    dropdownEntities = SECTIONS.map((sec) => ({
      id: sec,
      label: `${sec}`,
    }))
  } else if (viewType === 'location') {
    const uniqueLocationsSet = new Set<string>()
    safeSlots.forEach((slot) => {
      if (slot.location) {
        const rooms = slot.location.split(/[,;/]+/).map((r) => r.trim()).filter((r) => r.length > 0)
        rooms.forEach((room) => uniqueLocationsSet.add(room))
      }
    })
    const uniqueLocations = Array.from(uniqueLocationsSet)
    dropdownEntities = uniqueLocations.map((loc) => ({
      id: loc,
      label: `Salle: ${loc}`,
    }))
    dropdownEntities.sort((a, b) => a.label.localeCompare(b.label))

    if (safeSlots.some((s) => !s.location)) {
      dropdownEntities.push({ id: 'none', label: 'Sans salle' })
    }
  }

  // Populate person options with "Non assignés"
  const personOptions: { id: string; name: string; role: string }[] = (staffs || []).map((st) => ({
    id: st.id,
    name: `${st.firstName} ${st.lastName}`,
    role: st.role,
  }))
  personOptions.sort((a, b) => a.name.localeCompare(b.name))

  if (safeSlots.some((s) => !s.speakerId && !s.assistantId && !s.rcId)) {
    personOptions.push({
      id: 'none',
      name: 'Non assignés',
      role: 'Créneaux libres',
    })
  }

  // Filter persons based on typing search term
  const matchingPersons = personOptions.filter((p) =>
    p.name.toLowerCase().includes(personSearchQuery.toLowerCase())
  )

  // Resolve active entity ID
  let activeEntityId = ''
  if (viewType === 'person') {
    activeEntityId = personOptions.some((p) => p.id === selectedEntityId)
      ? selectedEntityId
      : (personOptions[0]?.id || '')
  } else {
    activeEntityId = dropdownEntities.some((e) => e.id === selectedEntityId)
      ? selectedEntityId
      : (dropdownEntities[0]?.id || '')
  }

  const activePerson = personOptions.find((p) => p.id === activeEntityId)
  
  // Value to display in the autocomplete search bar
  const autocompleteDisplayValue = isAutocompleteFocused 
    ? personSearchQuery 
    : (activePerson ? activePerson.name : '')

  const handleAutocompleteFocus = () => {
    setIsAutocompleteFocused(true)
    if (activePerson) {
      setPersonSearchQuery(activePerson.name)
    } else {
      setPersonSearchQuery('')
    }
  }

  const handleSelectPerson = (personId: string, personName: string) => {
    setSelectedEntityId(personId)
    setPersonSearchQuery(personName)
    setIsAutocompleteFocused(false)
  }

  // Filter slots for a given day and selected entity
  const getSlotsForDay = (dateStr: string) => {
    const combinedSlots = [...safeSlots, ...mappedTaskSlots, ...mappedShiftSlots]
    return combinedSlots
      .filter((slot) => {
        if (getSlotDateStr(slot.startTime) !== dateStr) return false

        if (viewType === 'section') {
          return slot.section?.name?.toUpperCase() === activeEntityId.toUpperCase()
        } else if (viewType === 'location') {
          if (activeEntityId === 'none') {
            return !slot.location
          }
          if (!slot.location) return false
          const rooms = slot.location.split(/[,;/]+/).map((r: string) => r.trim().toUpperCase()).filter((r: string) => r.length > 0)
          return rooms.includes(activeEntityId.toUpperCase())
        } else if (viewType === 'person') {
          if (activeEntityId === 'none') {
            return !slot.speakerId && !slot.assistantId && !slot.rcId && !slot.assignedStaffId
          }
          return (
            slot.speakerId === activeEntityId ||
            slot.assistantId === activeEntityId ||
            slot.rcId === activeEntityId ||
            slot.assignedStaffId === activeEntityId
          )
        }
        return false
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  return (
    <div className="schedule-page">
      {/* Top Header Grid Row */}
      <div className="schedule-header-row">
        <div className="schedule-title-area">
          <h1>Planning</h1>
          <span className="print-subtitle" style={{ display: 'none', color: '#1e293b', fontSize: '1.1rem', fontWeight: 600, marginLeft: '1rem' }}>
            {viewType === 'section' && `Section: ${activeEntityId}`}
            {viewType === 'location' && `Salle: ${activeEntityId}`}
            {viewType === 'person' && `Personne: ${activePerson ? activePerson.name : ''}`}
          </span>
        </div>
        
        {/* Centered Selector panel */}
        <div className="controls-center">
          <div className="toggle-container">
            <button
              className={`toggle-btn ${viewType === 'section' ? 'active' : ''}`}
              onClick={() => {
                setViewType('section')
                setSelectedEntityId('')
              }}
            >
              Par section
            </button>
            <button
              className={`toggle-btn ${viewType === 'location' ? 'active' : ''}`}
              onClick={() => {
                setViewType('location')
                setSelectedEntityId('')
              }}
            >
              Par salle
            </button>
            <button
              className={`toggle-btn ${viewType === 'person' ? 'active' : ''}`}
              onClick={() => {
                setViewType('person')
                setSelectedEntityId('')
                setPersonSearchQuery('')
              }}
            >
              Par personne
            </button>
          </div>

          {/* Under Toggle: Render dropdown for sections/rooms OR autocomplete search bar for staff */}
          {viewType === 'person' ? (
            <div className="autocomplete-container">
              <input
                type="text"
                className="person-search-input"
                placeholder="Rechercher un membre..."
                value={autocompleteDisplayValue}
                onChange={(e) => setPersonSearchQuery(e.target.value)}
                onFocus={handleAutocompleteFocus}
                onBlur={() => setIsAutocompleteFocused(false)}
              />
              {isAutocompleteFocused && (
                <div className="suggestions-list">
                  {matchingPersons.length > 0 ? (
                    matchingPersons.map((p) => (
                      <div
                        key={p.id}
                        className="suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevents input blur before selection completes
                          handleSelectPerson(p.id, p.name);
                        }}
                      >
                        <span>{p.name}</span>
                        <span className="suggestion-subtitle">{p.role}</span>
                      </div>
                    ))
                  ) : (
                    <div className="no-suggestions">Aucun membre trouvé</div>
                  )}
                </div>
              )}
            </div>
          ) : dropdownEntities.length > 0 ? (
            <div className="entity-selector-wrapper">
              <select
                className="entity-select"
                value={activeEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                {dropdownEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
              Aucune entité trouvée
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'right', flex:1  }}>
          {viewType === 'section' && (
            <button
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ marginTop: 0 }}
            >
              + Ajouter un cours
            </button>
          )}
          {viewType === 'person' && (
            <button
              className="btn-primary"
              onClick={() => setShowCreateShiftModal(true)}
              style={{ marginTop: 0, background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)', color: 'white' }}
            >
              + Ajouter un shift
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => window.print()}
            style={{
              marginTop: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white'
            }}
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>
      {/* Calendar App Grid */}
      <div className="calendar-container">
        <div className="calendar-grid">
          {/* Top-left corner spacer */}
          <div className="corner-header"></div>
          
          {/* Day Headers (Sticky top) */}
          {DAYS.map((day) => (
            <div className="day-header" key={day.dateStr}>
              <span className="day-title">{day.fullLabel.split(' ')[0]} {day.fullLabel.split(' ')[1]}</span>
              <span className="day-subtitle">{day.fullLabel.split(' ').slice(2).join(' ')}</span>
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
          {DAYS.map((day) => {
            const daySlots = getSlotsForDay(day.dateStr)
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
                    return (
                      <AbsoluteSlotCard
                        key={slot.id}
                        slot={slot}
                        style={cardStyle}
                        formatTime={formatTime}
                        onClick={() => {
                          if (slot.isShift) {
                            setSelectedShiftForEdit(slot)
                          } else if (!slot.isOperationalTask) {
                            setSelectedSlotForEdit(slot)
                          }
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {showCreateModal && (
        <CreateClassModal
          defaultSection={activeEntityId}
          onClose={() => setShowCreateModal(false)}
        />
      )}
      {showCreateShiftModal && (
        <CreateShiftModal
          defaultStaffId={viewType === 'person' && activeEntityId !== 'none' ? activeEntityId : ''}
          onClose={() => setShowCreateShiftModal(false)}
        />
      )}
      {selectedSlotForEdit && (
        <EditClassModal
          slot={selectedSlotForEdit}
          onClose={() => setSelectedSlotForEdit(null)}
        />
      )}
      {selectedShiftForEdit && (
        <EditShiftModal
          shift={selectedShiftForEdit}
          onClose={() => setSelectedShiftForEdit(null)}
        />
      )}
    </div>
  )
}

interface AbsoluteSlotCardProps {
  slot: any
  style: React.CSSProperties
  formatTime: (date: Date | string) => string
  onClick?: () => void
}

function AbsoluteSlotCard({ slot, style, formatTime, onClick }: AbsoluteSlotCardProps) {
  const cardTypeClass = slot.type ? slot.type.toLowerCase() : 'special'

  const isOpTask = slot.isOperationalTask
  const isShift = slot.isShift

  const shiftColors: Record<string, string> = {
    Logistique: '#ec4899',
    Catering: '#f97316',
    Animation: '#10b981',
    Communication: '#06b6d4',
    Staff: '#8b5cf6',
    RC: '#eab308',
    Speaker: '#3b82f6',
    Assistanat: '#14b8a6',
  }

  let customStyle: React.CSSProperties = style
  if (isOpTask) {
    customStyle = {
      ...style,
      borderLeftColor:
        slot.category === 'LOGISTIQUE'
          ? '#6366f1'
          : slot.category === 'MATERIEL'
          ? '#06b6d4'
          : slot.category === 'ANIMATION'
          ? '#10b981'
          : slot.category === 'PEDAGOGIE'
          ? '#f59e0b'
          : '#ec4899',
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      color: 'white',
    }
  } else if (isShift) {
    const shiftColor = shiftColors[slot.shiftType] || '#8b5cf6'
    customStyle = {
      ...style,
      borderLeftColor: shiftColor,
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      color: 'white',
      cursor: 'pointer',
    }
  }

  return (
    <div
      className={`slot-card-absolute ${cardTypeClass}`}
      style={customStyle}
      onClick={isOpTask ? undefined : onClick}
      title={`${slot.title}\n🕒 ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}\n${slot.description || ''}`}
    >
      <div className="card-time">
        <span>🕒 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
        {isOpTask && (
          <span style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.2)', padding: '0.05rem 0.3rem', borderRadius: '3px', marginLeft: 'auto' }}>
            ⚙️ Opération
          </span>
        )}
        {isShift && (
          <span style={{ fontSize: '0.62rem', background: 'rgba(168, 85, 247, 0.3)', padding: '0.05rem 0.3rem', borderRadius: '3px', marginLeft: 'auto' }}>
            🗓️ Shift ({slot.shiftType})
          </span>
        )}
      </div>

      <div className="card-title">{slot.title}</div>

      <div className="card-meta-row">
        {slot.location && (
          <span className="card-meta-item" title={`Lieu: ${slot.location}`}>
            📍 {slot.location}
          </span>
        )}
      </div>
    </div>
  )
}

export default Schedule