import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { trpc } from '../trpc'
import { Modal, Button, Badge } from '@s4s/ui'
import CreateClassModal from '../components/CreateClassModal'
import EditClassModal from '../components/EditClassModal'
import CreateShiftModal from '../components/CreateShiftModal'
import EditShiftModal from '../components/EditShiftModal'
import ImportScheduleModal from '../components/ImportScheduleModal'
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
  'GM',
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
  const [showImportModal, setShowImportModal] = useState<boolean>(false)
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false)
  const [selectedSlotForEdit, setSelectedSlotForEdit] = useState<any | null>(null)
  const [selectedShiftForEdit, setSelectedShiftForEdit] = useState<any | null>(null)
  const [selectedWorkshopForView, setSelectedWorkshopForView] = useState<any | null>(null)
  const [duplicateInitialData, setDuplicateInitialData] = useState<any | null>(null)

  const { data: slots, isLoading: loadingSlots, error: errorSlots } = trpc.schedules.list.useQuery()
  const { data: staffs, isLoading: loadingStaffs } = trpc.staffs.list.useQuery()
  const { data: tasks = [] } = trpc.tasks.list.useQuery()
  const { data: shifts = [] } = trpc.shifts.list.useQuery()
  const { data: workshops = [] } = trpc.workshops.list.useQuery()
  const { data: rooms = [] } = trpc.rooms.list.useQuery()

  // Map operational tasks assigned to staff members so they show up on their schedule
  const mappedTaskSlots = useMemo(() => {
    if (!tasks || tasks.length === 0) return []
    const mapped: any[] = []

    tasks.forEach((task: any) => {
      if (task.assignments && task.assignments.length > 0) {
        task.assignments.forEach((assignment: any) => {
          mapped.push({
            id: `task-${task.id}-${assignment.staffMemberId}`,
            taskId: task.id,
            title: `[${task.category}] ${task.name}`,
            description: task.description || `Tâche Opérationnelle - Pôle ${task.category}`,
            startTime: task.startTime,
            endTime: task.endTime,
            location: task.location,
            roomId: task.roomId || null,
            room: task.room || null,
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

  // Map workshop sessions so they appear on room schedules and general planning
  const mappedWorkshopSlots = useMemo(() => {
    if (!workshops || workshops.length === 0) return []
    const mapped: any[] = []

    workshops.forEach((workshop: any) => {
      (workshop.dates || []).forEach((session: any) => {
        const loc = session.location || session.room?.name || workshop.room?.name || workshop.location || ''
        const roomId = session.roomId || workshop.roomId || session.room?.id || workshop.room?.id || null
        const roomObj =
          session.room ||
          workshop.room ||
          (roomId ? rooms.find((r: any) => r.id === roomId) : null) ||
          null

        const isConf = (workshop.category || 'Workshop') === 'Conférences'
        mapped.push({
          id: `workshop-${workshop.id}-${session.id}`,
          workshopId: workshop.id,
          sessionId: session.id,
          title: `[${isConf ? 'Conférence' : 'Workshop'}] ${workshop.title}`,
          description: workshop.description || (isConf ? 'Conférence' : 'Atelier / Workshop'),
          startTime: session.startTime,
          endTime: session.endTime,
          location: loc,
          roomId: roomId,
          room: roomObj,
          type: 'WORKSHOP' as const,
          isWorkshop: true,
          category: workshop.category || 'Workshop',
          speakerId: null,
          assistantId: null,
          rcId: null,
          section: null,
          rawWorkshop: workshop,
          rawSession: session,
        })
      })
    })
    return mapped
  }, [workshops, rooms])

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
  const calculateCardStyle = (startTime: Date | string, endTime: Date | string, customHourHeight?: number) => {
    const start = typeof startTime === 'string' ? new Date(startTime) : startTime
    const end = typeof endTime === 'string' ? new Date(endTime) : endTime

    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()

    const timelineStartMin = START_HOUR * 60 // 480 min (08:00)
    const timelineEndMin = 20 * 60 // 1200 min (20:00)

    // Clamp coordinates to the 08:00 - 20:00 range
    const clampedStartMin = Math.max(timelineStartMin, Math.min(timelineEndMin, startMin))
    const clampedEndMin = Math.max(timelineStartMin, Math.min(timelineEndMin, endMin))

    const topFraction = (clampedStartMin - timelineStartMin) / 60
    const heightFraction = (clampedEndMin - clampedStartMin) / 60

    if (customHourHeight) {
      return {
        top: `${(topFraction * customHourHeight).toFixed(1)}px`,
        height: `${Math.max(26, heightFraction * customHourHeight).toFixed(1)}px`,
      }
    }

    return {
      top: `calc(${topFraction} * var(--hour-height, 80px))`,
      height: `max(28px, calc(${heightFraction} * var(--hour-height, 80px)))`,
    }
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

    // Group into connected components of overlapping slots
    const clusters: typeof parsed[] = []
    let currentCluster: typeof parsed = []
    let clusterEnd = -1

    // Sort by start time
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
      // Assign columns using greedy coloring algorithm
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

    // 1. Rooms from DB
    rooms.forEach((r: any) => {
      if (r.name && r.name.trim()) {
        uniqueLocationsSet.add(r.name.trim())
      }
    })

    // 2. Locations from safeSlots (classes)
    safeSlots.forEach((slot) => {
      if (slot.location) {
        const rList = slot.location.split(/[,;/]+/).map((r) => r.trim()).filter((r) => r.length > 0)
        rList.forEach((room) => uniqueLocationsSet.add(room))
      }
      if (slot.room?.name) {
        uniqueLocationsSet.add(slot.room.name.trim())
      }
    })

    // 3. Locations from workshops
    mappedWorkshopSlots.forEach((wSlot) => {
      if (wSlot.location) {
        const rList = wSlot.location.split(/[,;/]+/).map((r: string) => r.trim()).filter((r: string) => r.length > 0)
        rList.forEach((room: string) => uniqueLocationsSet.add(room))
      }
      if (wSlot.room?.name) {
        uniqueLocationsSet.add(wSlot.room.name.trim())
      }
    })

    // 4. Locations from tasks
    mappedTaskSlots.forEach((tSlot) => {
      if (tSlot.location) {
        const rList = tSlot.location.split(/[,;/]+/).map((r: string) => r.trim()).filter((r: string) => r.length > 0)
        rList.forEach((room: string) => uniqueLocationsSet.add(room))
      }
    })

    const uniqueLocations = Array.from(uniqueLocationsSet)
    dropdownEntities = uniqueLocations.map((loc) => ({
      id: loc,
      label: `Salle: ${loc}`,
    }))
    dropdownEntities.sort((a, b) => a.label.localeCompare(b.label))

    if (safeSlots.some((s) => !s.location) || mappedWorkshopSlots.some((w) => !w.location)) {
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
    const combinedSlots = [...safeSlots, ...mappedTaskSlots, ...mappedShiftSlots, ...mappedWorkshopSlots]
    const filtered = combinedSlots.filter((slot) => {
      if (getSlotDateStr(slot.startTime) !== dateStr) return false

      if (viewType === 'section') {
        const slotSectionNames = [
          slot.section?.name,
          ...(slot.sections || []).map((s: any) => s.name),
        ]
          .filter(Boolean)
          .map((n: string) => n.toUpperCase())

        return slotSectionNames.includes(activeEntityId.toUpperCase())
      } else if (viewType === 'location') {
        if (activeEntityId === 'none') {
          return !slot.location && !slot.room && !slot.roomId
        }
        const activeUpper = activeEntityId.trim().toUpperCase()

        // Match by room object name
        if (slot.room?.name && slot.room.name.trim().toUpperCase() === activeUpper) {
          return true
        }

        // Match by roomId if activeEntity matches any room with that id
        if (slot.roomId) {
          const matchedDbRoom = rooms.find((r: any) => r.id === slot.roomId)
          if (matchedDbRoom && matchedDbRoom.name.trim().toUpperCase() === activeUpper) {
            return true
          }
        }

        // Match by location string tokens
        if (slot.location) {
          const slotRooms = slot.location.split(/[,;/]+/).map((r: string) => r.trim().toUpperCase()).filter((r: string) => r.length > 0)
          if (slotRooms.includes(activeUpper)) {
            return true
          }
        }
        return false
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

    // If viewing by location or section, deduplicate operational tasks so multi-assigned tasks don't duplicate
    if (viewType !== 'person') {
      const seenTaskIds = new Set<string>()
      const deduplicated: typeof filtered = []
      for (const slot of filtered) {
        if (slot.isOperationalTask && slot.taskId) {
          if (seenTaskIds.has(slot.taskId)) continue
          seenTaskIds.add(slot.taskId)
        }
        deduplicated.push(slot)
      }
      return deduplicated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  // Filter slots for a specific room and day for batch room exports
  const getSlotsForDayAndRoom = (dateStr: string, roomName: string) => {
    const combinedSlots = [...safeSlots, ...mappedTaskSlots, ...mappedShiftSlots, ...mappedWorkshopSlots]
    const activeUpper = roomName.trim().toUpperCase()

    const filtered = combinedSlots.filter((slot) => {
      if (getSlotDateStr(slot.startTime) !== dateStr) return false

      if (slot.room?.name && slot.room.name.trim().toUpperCase() === activeUpper) {
        return true
      }

      if (slot.roomId) {
        const matchedDbRoom = rooms.find((r: any) => r.id === slot.roomId)
        if (matchedDbRoom && matchedDbRoom.name.trim().toUpperCase() === activeUpper) {
          return true
        }
      }

      if (slot.location) {
        const slotRooms = slot.location
          .split(/[,;/]+/)
          .map((r: string) => r.trim().toUpperCase())
          .filter((r: string) => r.length > 0)
        if (slotRooms.includes(activeUpper)) {
          return true
        }
      }

      return false
    })

    const seenTaskIds = new Set<string>()
    const deduplicated: typeof filtered = []
    for (const slot of filtered) {
      if (slot.isOperationalTask && slot.taskId) {
        if (seenTaskIds.has(slot.taskId)) continue
        seenTaskIds.add(slot.taskId)
      }
      deduplicated.push(slot)
    }

    return deduplicated.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }

  const allRoomLocations = useMemo(() => {
    const uniqueLocationsSet = new Set<string>()

    rooms.forEach((r: any) => {
      if (r.name && r.name.trim()) uniqueLocationsSet.add(r.name.trim())
    })

    safeSlots.forEach((slot) => {
      if (slot.location) {
        const rList = slot.location.split(/[,;/]+/).map((r: string) => r.trim()).filter((r: string) => r.length > 0)
        rList.forEach((room: string) => uniqueLocationsSet.add(room))
      }
      if (slot.room?.name) uniqueLocationsSet.add(slot.room.name.trim())
    })

    mappedWorkshopSlots.forEach((wSlot) => {
      if (wSlot.location) {
        const rList = wSlot.location.split(/[,;/]+/).map((r: string) => r.trim()).filter((r: string) => r.length > 0)
        rList.forEach((room: string) => uniqueLocationsSet.add(room))
      }
      if (wSlot.room?.name) uniqueLocationsSet.add(wSlot.room.name.trim())
    })

    mappedTaskSlots.forEach((tSlot) => {
      if (tSlot.location) {
        const rList = tSlot.location.split(/[,;/]+/).map((r: string) => r.trim()).filter((r: string) => r.length > 0)
        rList.forEach((room: string) => uniqueLocationsSet.add(room))
      }
    })

    const list = Array.from(uniqueLocationsSet)
    list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    return list
  }, [rooms, safeSlots, mappedWorkshopSlots, mappedTaskSlots])

  const handleExportJSON = () => {
    if (!safeSlots || safeSlots.length === 0) {
      alert('Aucun créneau à exporter.')
      return
    }

    const exportData = safeSlots.map((slot) => {
      const sectionNames = [
        slot.section?.name,
        ...(slot.sections || []).map((s: any) => s.name),
      ].filter(Boolean)

      const uniqueSectionNames = Array.from(new Set(sectionNames))

      const speakerName = slot.speaker
        ? `${slot.speaker.firstName} ${slot.speaker.lastName}`.trim()
        : null
      const assistantName = slot.assistant
        ? `${slot.assistant.firstName} ${slot.assistant.lastName}`.trim()
        : null
      const rcName = slot.rc
        ? `${slot.rc.firstName} ${slot.rc.lastName}`.trim()
        : null

      return {
        id: slot.id,
        title: slot.title,
        description: slot.description || null,
        type: slot.type,
        startTime: new Date(slot.startTime).toISOString(),
        endTime: new Date(slot.endTime).toISOString(),
        location: slot.location || null,
        roomName: slot.room?.name || slot.location || null,
        sections: uniqueSectionNames,
        targetGroup: slot.targetGroup || null,
        speaker: speakerName,
        assistant: assistantName,
        rc: rcName,
      }
    })

    const jsonStr = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `planning_s4s_${new Date().toISOString().slice(0, 10)}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    if (!safeSlots || safeSlots.length === 0) {
      alert('Aucun créneau à exporter.')
      return
    }

    const headers = [
      'Titre',
      'Description',
      'Type',
      'HeureDebut',
      'HeureFin',
      'Lieu',
      'Sections',
      'Groupe',
      'Speaker',
      'Assistant',
      'RC',
    ]

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const rows = safeSlots.map((slot) => {
      const sectionNames = [
        slot.section?.name,
        ...(slot.sections || []).map((s: any) => s.name),
      ].filter(Boolean)
      const uniqueSectionNames = Array.from(new Set(sectionNames)).join(', ')

      const speakerName = slot.speaker
        ? `${slot.speaker.firstName} ${slot.speaker.lastName}`.trim()
        : ''
      const assistantName = slot.assistant
        ? `${slot.assistant.firstName} ${slot.assistant.lastName}`.trim()
        : ''
      const rcName = slot.rc
        ? `${slot.rc.firstName} ${slot.rc.lastName}`.trim()
        : ''

      return [
        escapeCSV(slot.title),
        escapeCSV(slot.description || ''),
        escapeCSV(slot.type),
        escapeCSV(new Date(slot.startTime).toISOString()),
        escapeCSV(new Date(slot.endTime).toISOString()),
        escapeCSV(slot.location || ''),
        escapeCSV(uniqueSectionNames),
        escapeCSV(slot.targetGroup || ''),
        escapeCSV(speakerName),
        escapeCSV(assistantName),
        escapeCSV(rcName),
      ].join(';')
    })

    const csvContent = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `planning_s4s_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState('')

  const handleDownloadPDF = async () => {
    const element = document.getElementById('schedule-pdf-export')
    if (!element) return

    try {
      setIsGeneratingPDF(true)

      // Temporarily ensure element is ready for rendering
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        letterRendering: false,
        onclone: (clonedDoc) => {
          const clonedEl = clonedDoc.getElementById('schedule-pdf-export')
          if (clonedEl) {
            clonedEl.style.fontFamily = 'Arial, sans-serif'
          }
        },
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth() // 297mm
      const pdfHeight = pdf.internal.pageSize.getHeight() // 210mm

      const margin = 6
      const usableWidth = pdfWidth - margin * 2
      const usableHeight = pdfHeight - margin * 2

      let imgWidth = usableWidth
      let imgHeight = (canvas.height * usableWidth) / canvas.width

      if (imgHeight > usableHeight) {
        imgHeight = usableHeight
        imgWidth = (canvas.width * usableHeight) / canvas.height
      }

      const xOffset = margin + (usableWidth - imgWidth) / 2
      const yOffset = margin + (usableHeight - imgHeight) / 2

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight)

      const safeEntityName = (activeEntityId || 'global').replace(/[^a-zA-Z0-9_-]/g, '_')
      pdf.save(`planning_${viewType}_${safeEntityName}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Erreur lors de la génération du PDF.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const handleDownloadAllRoomsPDF = async () => {
    if (allRoomLocations.length === 0) {
      alert('Aucune salle trouvée à exporter.')
      return
    }

    try {
      setIsGeneratingPDF(true)
      setGeneratingProgress(`0 / ${allRoomLocations.length}`)

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth() // 297mm
      const pdfHeight = pdf.internal.pageSize.getHeight() // 210mm
      const margin = 6
      const usableWidth = pdfWidth - margin * 2
      const usableHeight = pdfHeight - margin * 2

      for (let i = 0; i < allRoomLocations.length; i++) {
        const roomName = allRoomLocations[i]
        setGeneratingProgress(`${i + 1} / ${allRoomLocations.length} (${roomName})`)

        const el = document.getElementById(`schedule-pdf-export-room-${i}`)
        if (!el) continue

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: false,
          onclone: (clonedDoc) => {
            const clonedEl = clonedDoc.getElementById(`schedule-pdf-export-room-${i}`)
            if (clonedEl) {
              clonedEl.style.fontFamily = 'Arial, sans-serif'
            }
          },
        })

        const imgData = canvas.toDataURL('image/png')
        let imgWidth = usableWidth
        let imgHeight = (canvas.height * usableWidth) / canvas.width

        if (imgHeight > usableHeight) {
          imgHeight = usableHeight
          imgWidth = (canvas.width * usableHeight) / canvas.height
        }

        const xOffset = margin + (usableWidth - imgWidth) / 2
        const yOffset = margin + (usableHeight - imgHeight) / 2

        if (i > 0) {
          pdf.addPage('a4', 'landscape')
        }

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight)
      }

      pdf.save(`planning_toutes_les_salles_2026.pdf`)
    } catch (error) {
      console.error('Error generating all rooms PDF:', error)
      alert('Erreur lors de la génération du PDF de toutes les salles.')
    } finally {
      setIsGeneratingPDF(false)
      setGeneratingProgress('')
    }
  }

  return (
    <div className="schedule-page">
      {/* Dedicated Print Banner - visible ONLY when printing */}
      <div className="print-schedule-banner">
        <div className="print-banner-left">
          <div className="print-banner-title">Planning Students 4 Students 2026</div>
          <div className="print-banner-badge">
            {viewType === 'section' && `Section : ${activeEntityId}`}
            {viewType === 'location' && `Salle : ${activeEntityId}`}
            {viewType === 'person' && `Planning individuel : ${activePerson ? `${activePerson.name} (${activePerson.role})` : 'Non assigné'}`}
          </div>
        </div>
      </div>

      {/* Top Header Grid Row (Interactive UI - hidden in print) */}
      <div className="schedule-header-row">
        <div className="schedule-title-area">
          <h1 style={{ margin: 0 }}>Planning</h1>
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', flex: 1, flexWrap: 'wrap' }}>
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
            onClick={() => setShowImportModal(true)}
            style={{
              marginTop: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
            }}
            title="Importer des données du planning (JSON ou CSV)"
          >
            📥 Importer
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn-primary"
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                marginTop: 0,
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'white',
              }}
              title="Exporter les données du planning"
            >
              📤 Exporter ▾
            </button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.35rem',
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                  zIndex: 50,
                  minWidth: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => {
                    handleExportJSON()
                    setShowExportMenu(false)
                  }}
                  style={{
                    padding: '0.6rem 1rem',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  📄 Exporter en JSON
                </button>
                <button
                  onClick={() => {
                    handleExportCSV()
                    setShowExportMenu(false)
                  }}
                  style={{
                    padding: '0.6rem 1rem',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  📊 Exporter en CSV
                </button>
              </div>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            style={{
              marginTop: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
              opacity: isGeneratingPDF ? 0.7 : 1,
            }}
            title="Télécharger la vue actuelle en PDF"
          >
            {isGeneratingPDF && !generatingProgress ? '⏳ Génération...' : '📥 Télécharger en PDF'}
          </button>
          <button
            className="btn-primary"
            onClick={handleDownloadAllRoomsPDF}
            disabled={isGeneratingPDF}
            style={{
              marginTop: 0,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: isGeneratingPDF ? 'not-allowed' : 'pointer',
              opacity: isGeneratingPDF ? 0.7 : 1,
            }}
            title="Télécharger le planning complet de chaque salle dans un seul document PDF multi-pages"
          >
            {isGeneratingPDF && generatingProgress ? `⏳ ${generatingProgress}` : '🏢 Toutes les salles (PDF)'}
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
                    return (
                      <AbsoluteSlotCard
                        key={slot.id}
                        slot={slot}
                        viewType={viewType}
                        activeEntityId={activeEntityId}
                        style={combinedStyle}
                        formatTime={formatTime}
                        onClick={() => {
                          if (slot.isShift) {
                            setSelectedShiftForEdit(slot)
                          } else if (slot.isWorkshop) {
                            setSelectedWorkshopForView(slot)
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

      {/* Dedicated Print Footer with S4S and AGEPoly logos */}
      <div className="print-schedule-footer">
        <div className="print-footer-logos">
          <img src="/s4s-logo.svg" alt="Students 4 Students" className="print-footer-logo-s4s" />
          <img src="/agep.svg" alt="AGEPoly" className="print-footer-logo-agep" />
        </div>
      </div>

      {/* Hidden layout rendered specifically for High-Definition PDF Export */}
      <div
        id="schedule-pdf-export"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: '1520px',
          backgroundColor: '#ffffff',
          color: '#312b48',
          fontFamily: "Arial, Helvetica, sans-serif",
          letterSpacing: 'normal',
          wordSpacing: 'normal',
          padding: '20px 24px 16px 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          zIndex: -1,
        }}
      >
        {/* Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '3px solid #41335f', marginBottom: '16px' }}>
          <div style={{ fontSize: '1.65rem', fontWeight: 'bold', color: '#312b48', letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>Planning Students 4 Students 2026</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#312b48', background: '#f4eaf3', border: '2px solid #41335f', padding: '6px 18px', borderRadius: '8px', letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>
            {viewType === 'section' && `Section : ${activeEntityId}`}
            {viewType === 'location' && `Salle : ${activeEntityId}`}
            {viewType === 'person' && `Planning individuel : ${activePerson ? `${activePerson.name} (${activePerson.role})` : 'Non assigné'}`}
          </div>
        </div>

        {/* Grid Container */}
        <div style={{ border: '2.5px solid #41335f', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', borderBottom: '2.5px solid #41335f', background: '#f4eaf3' }}>
            <div style={{ width: '70px', flexShrink: 0, height: '54px', borderRight: '1.5px solid #eed4f1' }} />
            {DAYS.map((day) => (
              <div key={day.dateStr} style={{ flex: 1, height: '54px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #eed4f1', boxSizing: 'border-box' }}>
                <span style={{ fontSize: '1.02rem', fontWeight: 'bold', color: '#312b48', lineHeight: 1.25, letterSpacing: 'normal', wordSpacing: 'normal' }}>{day.fullLabel.split(' ')[0]} {day.fullLabel.split(' ')[1]}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#41335f', lineHeight: 1.25, letterSpacing: 'normal', wordSpacing: 'normal' }}>{day.fullLabel.split(' ').slice(2).join(' ')}</span>
              </div>
            ))}
          </div>

          {/* Body Row (Time column + 8 day columns) */}
          <div style={{ display: 'flex', height: `${12 * 60}px`, position: 'relative' }}>
            {/* Time column */}
            <div style={{ width: '70px', flexShrink: 0, background: '#f4eaf3', borderRight: '2.5px solid #41335f', display: 'flex', flexDirection: 'column' }}>
              {HOURS.map((hour) => (
                <div key={hour} style={{ height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6px', fontSize: '0.86rem', fontWeight: 'bold', color: '#312b48', borderBottom: '1px solid #e5d3e4', boxSizing: 'border-box', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 8 Day columns */}
            {DAYS.map((day) => {
              const daySlots = getSlotsForDay(day.dateStr)
              const layoutMap = computeOverlappingLayout(daySlots)
              return (
                <div key={day.dateStr} style={{ flex: 1, height: `${12 * 60}px`, position: 'relative', borderRight: '1.5px solid #eed4f1', boxSizing: 'border-box' }}>
                  {/* Hour background lines */}
                  {HOURS.map((hour) => (
                    <div key={hour} style={{ height: '60px', borderBottom: '1px solid #f0e2ef', boxSizing: 'border-box' }} />
                  ))}

                  {/* Absolute Cards */}
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {daySlots.map((slot) => {
                      const cardStyle = calculateCardStyle(slot.startTime, slot.endTime, 60)
                      const sideStyle = layoutMap.get(slot.id)
                      const combinedStyle = sideStyle
                        ? { ...cardStyle, left: sideStyle.left, width: sideStyle.width, right: 'auto' }
                        : cardStyle

                      const displayLocation = viewType === 'location' && activeEntityId && activeEntityId !== 'none'
                        ? activeEntityId
                        : slot.location

                      const sectionsList = slot.sections && slot.sections.length > 0
                        ? slot.sections.map((s: any) => s.name).join(', ')
                        : slot.section?.name

                      return (
                        <div
                          key={slot.id}
                          className={`slot-card-absolute ${slot.type ? slot.type.toLowerCase() : 'special'}`}
                          style={{
                            position: 'absolute',
                            ...combinedStyle,
                            borderRadius: '5px',
                            borderWidth: '1.5px',
                            borderStyle: 'solid',
                            borderLeftWidth: '5px',
                            padding: '4px 6px',
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            fontFamily: "Arial, Helvetica, sans-serif",
                            letterSpacing: 'normal',
                            wordSpacing: 'normal',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.70rem', fontWeight: 'bold', color: '#0f172a', background: 'rgba(0, 0, 0, 0.08)', padding: '2px 5px', borderRadius: '3px', lineHeight: 1.2, letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>
                              🕒 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3, margin: '2px 0', letterSpacing: 'normal', wordSpacing: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                            {slot.title}
                          </div>
                          <div style={{ fontSize: '0.66rem', color: '#334155', fontWeight: 'bold', marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '3px 6px', lineHeight: 1.3, letterSpacing: 'normal', wordSpacing: 'normal' }}>
                            {displayLocation && <span style={{ whiteSpace: 'nowrap' }}>📍 {displayLocation}</span>}
                            {viewType !== 'section' && sectionsList && <span style={{ whiteSpace: 'nowrap' }}>👥 {sectionsList}</span>}
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

        {/* Footer with Logos */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginTop: '12px', paddingTop: '4px' }}>
          <img src="/s4s-logo.svg" alt="Students 4 Students" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
          <img src="/agep.svg" alt="AGEPoly" style={{ height: '24px', width: '105px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Hidden layout rendered for all rooms multi-page PDF Export */}
      <div
        id="schedule-all-rooms-pdf-export"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: -1,
        }}
      >
        {allRoomLocations.map((roomName, rIdx) => {
          return (
            <div
              key={roomName}
              id={`schedule-pdf-export-room-${rIdx}`}
              style={{
                width: '1520px',
                backgroundColor: '#ffffff',
                color: '#312b48',
                fontFamily: 'Arial, Helvetica, sans-serif',
                letterSpacing: 'normal',
                wordSpacing: 'normal',
                padding: '20px 24px 16px 24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '20px',
              }}
            >
              {/* Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '14px', borderBottom: '3px solid #41335f', marginBottom: '16px' }}>
                <div style={{ fontSize: '1.65rem', fontWeight: 'bold', color: '#312b48', letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>Planning Students 4 Students 2026</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#312b48', background: '#f4eaf3', border: '2px solid #41335f', padding: '6px 18px', borderRadius: '8px', letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>
                  Salle : {roomName}
                </div>
              </div>

              {/* Grid Container */}
              <div style={{ border: '2.5px solid #41335f', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
                {/* Header Row */}
                <div style={{ display: 'flex', borderBottom: '2.5px solid #41335f', background: '#f4eaf3' }}>
                  <div style={{ width: '70px', flexShrink: 0, height: '54px', borderRight: '1.5px solid #eed4f1' }} />
                  {DAYS.map((day) => (
                    <div key={day.dateStr} style={{ flex: 1, height: '54px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', borderRight: '1.5px solid #eed4f1', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '1.02rem', fontWeight: 'bold', color: '#312b48', lineHeight: 1.25, letterSpacing: 'normal', wordSpacing: 'normal' }}>{day.fullLabel.split(' ')[0]} {day.fullLabel.split(' ')[1]}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#41335f', lineHeight: 1.25, letterSpacing: 'normal', wordSpacing: 'normal' }}>{day.fullLabel.split(' ').slice(2).join(' ')}</span>
                    </div>
                  ))}
                </div>

                {/* Body Row (Time column + 8 day columns) */}
                <div style={{ display: 'flex', height: `${12 * 60}px`, position: 'relative' }}>
                  {/* Time column */}
                  <div style={{ width: '70px', flexShrink: 0, background: '#f4eaf3', borderRight: '2.5px solid #41335f', display: 'flex', flexDirection: 'column' }}>
                    {HOURS.map((hour) => (
                      <div key={hour} style={{ height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '6px', fontSize: '0.86rem', fontWeight: 'bold', color: '#312b48', borderBottom: '1px solid #e5d3e4', boxSizing: 'border-box', letterSpacing: 'normal', wordSpacing: 'normal' }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>

                  {/* 8 Day columns */}
                  {DAYS.map((day) => {
                    const daySlots = getSlotsForDayAndRoom(day.dateStr, roomName)
                    const layoutMap = computeOverlappingLayout(daySlots)
                    return (
                      <div key={day.dateStr} style={{ flex: 1, height: `${12 * 60}px`, position: 'relative', borderRight: '1.5px solid #eed4f1', boxSizing: 'border-box' }}>
                        {/* Hour background lines */}
                        {HOURS.map((hour) => (
                          <div key={hour} style={{ height: '60px', borderBottom: '1px solid #f0e2ef', boxSizing: 'border-box' }} />
                        ))}

                        {/* Absolute Cards */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                          {daySlots.map((slot) => {
                            const cardStyle = calculateCardStyle(slot.startTime, slot.endTime, 60)
                            const sideStyle = layoutMap.get(slot.id)
                            const combinedStyle = sideStyle
                              ? { ...cardStyle, left: sideStyle.left, width: sideStyle.width, right: 'auto' }
                              : cardStyle

                            const sectionsList = slot.sections && slot.sections.length > 0
                              ? slot.sections.map((s: any) => s.name).join(', ')
                              : slot.section?.name

                            return (
                              <div
                                key={slot.id}
                                className={`slot-card-absolute ${slot.type ? slot.type.toLowerCase() : 'special'}`}
                                style={{
                                  position: 'absolute',
                                  ...combinedStyle,
                                  borderRadius: '5px',
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                  borderLeftWidth: '5px',
                                  padding: '4px 6px',
                                  boxSizing: 'border-box',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  overflow: 'hidden',
                                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                                  fontFamily: 'Arial, Helvetica, sans-serif',
                                  letterSpacing: 'normal',
                                  wordSpacing: 'normal',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '0.70rem', fontWeight: 'bold', color: '#0f172a', background: 'rgba(0, 0, 0, 0.08)', padding: '2px 5px', borderRadius: '3px', lineHeight: 1.2, letterSpacing: 'normal', wordSpacing: 'normal', whiteSpace: 'nowrap' }}>
                                    🕒 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3, margin: '2px 0', letterSpacing: 'normal', wordSpacing: 'normal', wordBreak: 'normal', overflowWrap: 'break-word' }}>
                                  {slot.title}
                                </div>
                                <div style={{ fontSize: '0.66rem', color: '#334155', fontWeight: 'bold', marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '3px 6px', lineHeight: 1.3, letterSpacing: 'normal', wordSpacing: 'normal' }}>
                                  <span style={{ whiteSpace: 'nowrap' }}>📍 {roomName}</span>
                                  {sectionsList && <span style={{ whiteSpace: 'nowrap' }}>👥 {sectionsList}</span>}
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

              {/* Footer with Logos */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '20px', marginTop: '12px', paddingTop: '4px' }}>
                <img src="/s4s-logo.svg" alt="Students 4 Students" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
                <img src="/agep.svg" alt="AGEPoly" style={{ height: '24px', width: '105px', objectFit: 'contain' }} />
              </div>
            </div>
          )
        })}
      </div>

      {showCreateModal && (
        <CreateClassModal
          defaultSection={activeEntityId}
          initialData={duplicateInitialData}
          onClose={() => {
            setShowCreateModal(false)
            setDuplicateInitialData(null)
          }}
        />
      )}
      {showCreateShiftModal && (
        <CreateShiftModal
          defaultStaffId={viewType === 'person' && activeEntityId !== 'none' ? activeEntityId : ''}
          onClose={() => setShowCreateShiftModal(false)}
        />
      )}
      {showImportModal && (
        <ImportScheduleModal
          onClose={() => setShowImportModal(false)}
        />
      )}
      {selectedSlotForEdit && (
        <EditClassModal
          slot={selectedSlotForEdit}
          onClose={() => setSelectedSlotForEdit(null)}
          onDuplicate={(slotToDuplicate) => {
            setSelectedSlotForEdit(null)
            setDuplicateInitialData(slotToDuplicate)
            setShowCreateModal(true)
          }}
        />
      )}
      {selectedShiftForEdit && (
        <EditShiftModal
          shift={selectedShiftForEdit}
          onClose={() => setSelectedShiftForEdit(null)}
        />
      )}
      {selectedWorkshopForView && (
        <Modal
          isOpen={Boolean(selectedWorkshopForView)}
          onClose={() => setSelectedWorkshopForView(null)}
          title={selectedWorkshopForView.title}
          size="md"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', color: 'var(--s4s-text-primary)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Badge variant={selectedWorkshopForView.category === 'Conférences' ? 'secondary' : 'primary'}>
                {selectedWorkshopForView.category || 'Workshop'}
              </Badge>
              <span style={{ fontSize: '0.85rem', color: 'var(--s4s-text-muted)' }}>
                🕒 {formatTime(selectedWorkshopForView.startTime)} - {formatTime(selectedWorkshopForView.endTime)}
              </span>
            </div>

            {selectedWorkshopForView.description && (
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5, color: 'var(--s4s-text-secondary)' }}>
                {selectedWorkshopForView.description}
              </p>
            )}

            <div style={{ background: 'var(--s4s-bg-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--s4s-radius-md)', fontSize: '0.85rem' }}>
              <div>
                <strong>📍 Lieu / Salle :</strong> {selectedWorkshopForView.location || 'Non précisé'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedWorkshopForView(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface AbsoluteSlotCardProps {
  slot: any
  viewType: ViewType
  activeEntityId?: string
  style: React.CSSProperties
  formatTime: (date: Date | string) => string
  onClick?: () => void
}

function AbsoluteSlotCard({ slot, viewType, activeEntityId, style, formatTime, onClick }: AbsoluteSlotCardProps) {
  const cardTypeClass = slot.type ? slot.type.toLowerCase() : 'special'

  const isOpTask = slot.isOperationalTask
  const isShift = slot.isShift
  const isWorkshop = slot.isWorkshop

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
  } else if (isWorkshop) {
    customStyle = {
      ...style,
      cursor: 'pointer',
    }
  }

  const sectionsList = slot.sections && slot.sections.length > 0
    ? slot.sections.map((s: any) => s.name).join(', ')
    : slot.section?.name

  // When viewing/printing by room, only show the current room instead of the full multi-room list
  const displayLocation = viewType === 'location' && activeEntityId && activeEntityId !== 'none'
    ? activeEntityId
    : slot.location

  return (
    <div
      className={`slot-card-absolute ${cardTypeClass}`}
      style={customStyle}
      onClick={isOpTask ? undefined : onClick}
      title={`${slot.title}\n🕒 ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}\n${slot.description || ''}`}
    >
      <div className="card-time">
        <span className="card-time-badge">🕒 {formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
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
        {isWorkshop && (
          <span style={{ fontSize: '0.62rem', background: 'rgba(219, 39, 119, 0.2)', padding: '0.05rem 0.3rem', borderRadius: '3px', marginLeft: 'auto', color: '#be185d', fontWeight: 600 }}>
            🛠️ Workshop
          </span>
        )}
      </div>

      <div className="card-title">{slot.title}</div>

      <div className="card-meta-row">
        {displayLocation && (
          <span className="card-meta-item" title={`Lieu: ${displayLocation}`}>
            📍 {displayLocation}
          </span>
        )}
        {viewType !== 'section' && sectionsList && (
          <span className="card-meta-item" title={`Section: ${sectionsList}`}>
            👥 {sectionsList}
          </span>
        )}
      </div>
    </div>
  )
}

export default Schedule