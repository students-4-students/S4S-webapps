import { useState, useMemo, useEffect } from 'react'
import { trpc } from '../trpc'
import {
  formatDateTimeRange,
  toLocalDatetimeString,
  toISOStringFromLocal,
} from '@s4s/ui'
import '../../styles/workshops.css'

interface WorkshopSession {
  id: string
  startTime: Date | string
  endTime: Date | string
  roomId?: string | null
  location?: string | null
  room?: {
    id: string
    name: string
    building?: string | null
  } | null
  registrations?: any[]
}

interface Workshop {
  id: string
  title: string
  location: string
  roomId?: string | null
  room?: {
    id: string
    name: string
    building?: string | null
  } | null
  description: string
  image: string | null
  category?: string | null
  requiresRegistration: boolean
  onlyOneSlotPerUser?: boolean
  isRegistrationClosed?: boolean
  externalRegistrationUrl?: string | null
  infoUrl?: string | null
  infoDescription?: string | null
  maxParticipants: number | null
  dates: WorkshopSession[]
}

interface Participant {
  id: string
  firstName: string
  lastName: string
  email: string
  sectionName?: string
  sessionId?: string
  sessionTime?: string
  isPresent: boolean
}

export default function Workshops() {
  const [showModal, setShowModal] = useState(false)
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'required' | 'open'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Workshop' | 'Conférences'>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  // Drag and Drop & Image tab state
  const [isDragging, setIsDragging] = useState(false)
  const [imageTab, setImageTab] = useState<'file' | 'url'>('file')

  // Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('Workshop')
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [customLocation, setCustomLocation] = useState<string>('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [requiresRegistration, setRequiresRegistration] = useState(false)
  const [onlyOneSlotPerUser, setOnlyOneSlotPerUser] = useState(false)
  const [isRegistrationClosed, setIsRegistrationClosed] = useState(false)
  const [externalRegistrationUrl, setExternalRegistrationUrl] = useState('')
  const [infoUrl, setInfoUrl] = useState('')
  const [infoDescription, setInfoDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState<number | ''>('')
  const [dates, setDates] = useState<{
    startTime: string
    endTime: string
    roomId?: string
    location?: string
    customLocation?: string
  }[]>([])

  // Participants Modal State
  const [usersModalWorkshop, setUsersModalWorkshop] = useState<Workshop | null>(null)
  const [usersSearchQuery, setUsersSearchQuery] = useState('')
  const [usersSessionFilter, setUsersSessionFilter] = useState('all')

  // Manual participant add state
  const [showAddParticipantForm, setShowAddParticipantForm] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [studentSearchQuery, setStudentSearchQuery] = useState('')

  // Clean up legacy localStorage cache on mount
  useEffect(() => {
    try {
      localStorage.removeItem('gest4s_workshop_participants')
    } catch {}
  }, [])

  const utils = trpc.useUtils()

  // Queries & Mutations
  const { data: workshops = [], isLoading } = trpc.workshops.list.useQuery()
  const { data: dbRooms = [] } = trpc.rooms.list.useQuery()
  const { data: dbStudents = [] } = trpc.students.list.useQuery(undefined, {
    retry: false,
    staleTime: 60000,
  })

  const filteredDbStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return dbStudents
    const query = studentSearchQuery.toLowerCase()
    return dbStudents.filter((s: any) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(query) ||
      (s.email && s.email.toLowerCase().includes(query)) ||
      (s.section?.name && s.section.name.toLowerCase().includes(query))
    )
  }, [dbStudents, studentSearchQuery])

  const getWorkshopParticipants = (workshop: Workshop): Participant[] => {
    return (workshop.dates || []).flatMap((d: any) =>
      (d.registrations || []).map((r: any) => ({
        id: r.id,
        firstName: r.firstName || r.user?.firstName || 'Étudiant',
        lastName: r.lastName || r.user?.lastName || 'Inscrit',
        email: r.email || r.user?.email || 'N/A',
        sectionName: r.user?.section?.name || 'IN',
        sessionId: d.id,
        sessionTime: formatDateTimeRange(d.startTime, d.endTime),
        isPresent: Boolean(r.isPresent),
      }))
    )
  }

  const registerMutation = trpc.workshops.register.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    },
  })

  const unregisterMutation = trpc.workshops.unregister.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    },
  })

  const handleAddParticipantSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!usersModalWorkshop || !selectedStudentId) return
    const found = dbStudents.find((s: any) => s.id === selectedStudentId)
    if (!found) return
    const targetSessionId = selectedSlotId || (usersSessionFilter !== 'all' ? usersSessionFilter : (usersModalWorkshop.dates[0]?.id))
    if (targetSessionId) {
      registerMutation.mutate({
        sessionId: targetSessionId,
        firstName: found.firstName,
        lastName: found.lastName,
        email: found.email,
      })
    }
    setSelectedStudentId('')
    setSelectedSlotId('')
    setStudentSearchQuery('')
    setShowAddParticipantForm(false)
  }

  const removeParticipant = (_workshopId: string, participantId: string) => {
    if (!usersModalWorkshop) return
    const currentList = getWorkshopParticipants(usersModalWorkshop)
    const target = currentList.find(p => p.id === participantId)
    if (target && target.sessionId) {
      unregisterMutation.mutate({
        sessionId: target.sessionId,
        email: target.email,
      })
    }
  }

  const exportParticipantsCSV = (workshop: Workshop, list: Participant[]) => {
    const headers = ['Prénom', 'Nom', 'Email', 'Section', 'Session', 'Statut Émargement']
    const rows = list.map(p => [
      `"${p.firstName}"`,
      `"${p.lastName}"`,
      `"${p.email}"`,
      `"${p.sectionName || 'N/A'}"`,
      `"${p.sessionTime || 'Toutes les sessions'}"`,
      `"${p.isPresent ? 'Présent' : 'Attendu'}"`,
    ])
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `participants_${workshop.title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Real-time Updates via tRPC Subscription
  trpc.workshops.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.workshops.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Workshops subscription error:', err)
    }
  })

  const createMutation = trpc.workshops.create.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
      closeModal()
    }
  })

  const updateMutation = trpc.workshops.update.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
      closeModal()
    }
  })

  const deleteMutation = trpc.workshops.delete.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    }
  })

  // Real-time Conflict Query for the open modal slots
  const slotsForConflictCheck = useMemo(() => {
    if (!showModal) return []
    return dates.map(d => {
      let effectiveRoomId: string | null = null
      let effectiveLocation: string | null = null

      if (d.roomId === '__CUSTOM__') {
        effectiveRoomId = null
        effectiveLocation = d.customLocation || d.location || null
      } else if (d.roomId) {
        effectiveRoomId = d.roomId
        const r = dbRooms.find((room: any) => room.id === d.roomId)
        effectiveLocation = r?.name || null
      } else {
        if (selectedRoomId === '__CUSTOM__') {
          effectiveRoomId = null
          effectiveLocation = customLocation || location || null
        } else if (selectedRoomId) {
          effectiveRoomId = selectedRoomId
          const r = dbRooms.find((room: any) => room.id === selectedRoomId)
          effectiveLocation = r?.name || null
        } else {
          effectiveRoomId = null
          effectiveLocation = location || null
        }
      }

      return {
        startTime: d.startTime,
        endTime: d.endTime,
        roomId: effectiveRoomId,
        location: effectiveLocation,
      }
    })
  }, [showModal, dates, selectedRoomId, customLocation, location, dbRooms])

  const validSlotsForCheck = useMemo(() => {
    return slotsForConflictCheck
      .filter(s => s.startTime && s.endTime && !isNaN(new Date(s.startTime).getTime()) && !isNaN(new Date(s.endTime).getTime()))
      .map(s => ({
        startTime: new Date(s.startTime),
        endTime: new Date(s.endTime),
        roomId: s.roomId,
        location: s.location,
      }))
  }, [slotsForConflictCheck])

  const { data: slotConflicts = [] } = trpc.workshops.checkConflicts.useQuery(
    {
      workshopId: editingWorkshop?.id,
      slots: validSlotsForCheck,
    },
    {
      enabled: showModal && validSlotsForCheck.length > 0,
      refetchInterval: 8000,
    }
  )

  const hasConflictErrors = useMemo(() => {
    return slotConflicts.some((c: any) => c.severity === 'ERROR')
  }, [slotConflicts])

  // Keyboard shortcut (Escape to close modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (usersModalWorkshop) setUsersModalWorkshop(null)
        else if (showModal) closeModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal, usersModalWorkshop])

  const openCreateModal = () => {
    setEditingWorkshop(null)
    setTitle('')
    setSelectedRoomId('')
    setCustomLocation('')
    setLocation('')
    setDescription('')
    setImage('')
    setImageTab('file')
    setCategory('Workshop')
    setRequiresRegistration(false)
    setOnlyOneSlotPerUser(false)
    setIsRegistrationClosed(false)
    setExternalRegistrationUrl('')
    setInfoUrl('')
    setInfoDescription('')
    setMaxParticipants('')
    
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    setDates([{ 
      startTime: toLocalDatetimeString(now), 
      endTime: toLocalDatetimeString(twoHoursLater),
      roomId: '',
      location: '',
      customLocation: '',
    }])
    
    setShowModal(true)
  }

  const openEditModal = (w: Workshop) => {
    setEditingWorkshop(w)
    setTitle(w.title)
    setCategory(w.category || 'Workshop')
    
    // Resolve workshop room
    let initialRoomId = ''
    let initialCustom = ''
    if (w.roomId && dbRooms.some((r: any) => r.id === w.roomId)) {
      initialRoomId = w.roomId
    } else {
      const match = dbRooms.find((r: any) => r.name.toLowerCase() === w.location?.trim().toLowerCase())
      if (match) {
        initialRoomId = match.id
      } else if (w.location) {
        initialRoomId = '__CUSTOM__'
        initialCustom = w.location
      }
    }
    setSelectedRoomId(initialRoomId)
    setCustomLocation(initialCustom)
    setLocation(w.location || '')

    setDescription(w.description)
    setImage(w.image || '')
    setImageTab(w.image && !w.image.startsWith('data:') ? 'url' : 'file')
    setRequiresRegistration(w.requiresRegistration)
    setOnlyOneSlotPerUser(Boolean(w.onlyOneSlotPerUser))
    setIsRegistrationClosed(Boolean(w.isRegistrationClosed))
    setExternalRegistrationUrl(w.externalRegistrationUrl || '')
    setInfoUrl(w.infoUrl || '')
    setInfoDescription(w.infoDescription || '')
    setMaxParticipants(w.maxParticipants ?? '')
    
    const sortedDates = [...(w.dates || [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    setDates(
      sortedDates.map(d => {
        let dRoomId = ''
        let dCustom = ''
        if (d.roomId && dbRooms.some((r: any) => r.id === d.roomId)) {
          dRoomId = d.roomId
        } else if (d.location) {
          const match = dbRooms.find((r: any) => r.name.toLowerCase() === d.location?.trim().toLowerCase())
          if (match) {
            dRoomId = match.id
          } else {
            dRoomId = '__CUSTOM__'
            dCustom = d.location
          }
        }
        return {
          startTime: toLocalDatetimeString(d.startTime),
          endTime: toLocalDatetimeString(d.endTime),
          roomId: dRoomId,
          location: d.location || '',
          customLocation: dCustom,
        }
      })
    )
    setShowModal(true)
  }

  const openUsersModal = (w: Workshop) => {
    setUsersModalWorkshop(w)
    setUsersSearchQuery('')
    setUsersSessionFilter('all')
    setShowAddParticipantForm(false)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingWorkshop(null)
    setIsDragging(false)
  }

  // Image Upload Processing
  const processFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (maximum 2 Mo).")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  // Session Dates Management
  const handleAddDate = () => {
    const now = new Date()
    let startStr = toLocalDatetimeString(now)
    let endStr = toLocalDatetimeString(new Date(now.getTime() + 2 * 60 * 60 * 1000))

    if (dates.length > 0) {
      const lastEnd = new Date(dates[dates.length - 1].endTime)
      if (!isNaN(lastEnd.getTime())) {
        startStr = toLocalDatetimeString(lastEnd)
        endStr = toLocalDatetimeString(new Date(lastEnd.getTime() + 2 * 60 * 60 * 1000))
      }
    }
    
    setDates([...dates, { startTime: startStr, endTime: endStr, roomId: '', location: '', customLocation: '' }])
  }

  const handleRemoveDate = (index: number) => {
    setDates(dates.filter((_, i) => i !== index))
  }

  const handleDateChange = (index: number, field: string, val: string) => {
    const updated = [...dates]
    updated[index] = {
      ...updated[index],
      [field]: val
    }
    setDates(updated)
  }

  const handleMainRoomChange = (roomIdVal: string) => {
    setSelectedRoomId(roomIdVal)
    if (roomIdVal === '__CUSTOM__') {
      setLocation(customLocation)
    } else if (roomIdVal) {
      const found = dbRooms.find((r: any) => r.id === roomIdVal)
      if (found) {
        setLocation(found.name)
      }
    } else {
      setLocation('')
    }
  }

  const handleSlotRoomChange = (index: number, val: string) => {
    const updated = [...dates]
    if (val === '__CUSTOM__') {
      updated[index] = {
        ...updated[index],
        roomId: '__CUSTOM__',
        location: updated[index].customLocation || '',
      }
    } else if (val) {
      const found = dbRooms.find((r: any) => r.id === val)
      updated[index] = {
        ...updated[index],
        roomId: val,
        location: found?.name || '',
      }
    } else {
      updated[index] = {
        ...updated[index],
        roomId: '',
        location: '',
      }
    }
    setDates(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (dates.length === 0) {
      alert("Veuillez ajouter au moins une session pour le workshop.")
      return
    }

    // Determine final workshop location string
    let finalLocation = location.trim()
    let finalRoomId: string | null = null

    if (selectedRoomId === '__CUSTOM__') {
      finalLocation = customLocation.trim()
      finalRoomId = null
    } else if (selectedRoomId) {
      const r = dbRooms.find((room: any) => room.id === selectedRoomId)
      finalLocation = r?.name || location.trim()
      finalRoomId = selectedRoomId
    }

    if (!finalLocation) {
      alert("Veuillez renseigner un lieu ou sélectionner une salle pour le workshop.")
      return
    }

    // Verify endTimes are after startTimes & values are present
    for (let i = 0; i < dates.length; i++) {
      if (!dates[i].startTime || !dates[i].endTime) {
        alert(`Session #${i + 1}: Veuillez renseigner l'heure de début et de fin.`)
        return
      }
      const start = new Date(dates[i].startTime)
      const end = new Date(dates[i].endTime)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert(`Session #${i + 1}: Date/heure invalide.`)
        return
      }
      if (end <= start) {
        alert(`Session #${i + 1}: L'heure de fin doit être postérieure à l'heure de début.`)
        return
      }
    }

    const payload = {
      title: title.trim(),
      category: category || 'Workshop',
      location: finalLocation,
      roomId: finalRoomId,
      description: description.trim(),
      image: image.trim() || undefined,
      requiresRegistration,
      onlyOneSlotPerUser: requiresRegistration ? onlyOneSlotPerUser : false,
      isRegistrationClosed,
      externalRegistrationUrl: requiresRegistration && externalRegistrationUrl.trim() ? externalRegistrationUrl.trim() : null,
      infoUrl: infoUrl.trim() ? infoUrl.trim() : null,
      infoDescription: infoDescription.trim() ? infoDescription.trim() : null,
      maxParticipants: requiresRegistration && !externalRegistrationUrl.trim() && maxParticipants !== '' ? Number(maxParticipants) : null,
      dates: dates.map(d => {
        let slotRoomId: string | null = null
        let slotLocation: string | null = null

        if (d.roomId === '__CUSTOM__') {
          slotRoomId = null
          slotLocation = d.customLocation?.trim() || d.location?.trim() || null
        } else if (d.roomId) {
          slotRoomId = d.roomId
          const r = dbRooms.find((room: any) => room.id === d.roomId)
          slotLocation = r?.name || null
        } else {
          slotRoomId = finalRoomId
          slotLocation = finalLocation || null
        }

        return {
          startTime: toISOStringFromLocal(d.startTime),
          endTime: toISOStringFromLocal(d.endTime),
          roomId: slotRoomId,
          location: slotLocation,
        }
      })
    }

    if (editingWorkshop) {
      updateMutation.mutate({
        id: editingWorkshop.id,
        ...payload
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le workshop "${title}" ?`)) {
      deleteMutation.mutate({ id })
    }
  }

  // Filtered Workshops
  const filteredWorkshops = useMemo(() => {
    const now = new Date().getTime()

    return workshops.filter((w: Workshop) => {
      const matchesSearch = 
        !searchQuery ||
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (w.room?.name && w.room.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesReg = 
        registrationFilter === 'all' ||
        (registrationFilter === 'required' && w.requiresRegistration) ||
        (registrationFilter === 'open' && !w.requiresRegistration)

      const matchesCategory =
        categoryFilter === 'all' ||
        (w.category || 'Workshop') === categoryFilter

      let matchesTime = true
      if (timeFilter !== 'all') {
        const hasUpcomingSession = w.dates.some(d => new Date(d.endTime).getTime() > now)
        if (timeFilter === 'upcoming') {
          matchesTime = hasUpcomingSession
        } else if (timeFilter === 'past') {
          matchesTime = !hasUpcomingSession
        }
      }

      return matchesSearch && matchesReg && matchesCategory && matchesTime
    })
  }, [workshops, searchQuery, registrationFilter, categoryFilter, timeFilter])

  const hasActiveFilters = searchQuery !== '' || registrationFilter !== 'all' || categoryFilter !== 'all' || timeFilter !== 'all'

  // Active Participants List for Modal
  const currentWorkshopParticipants = useMemo(() => {
    if (!usersModalWorkshop) return []
    return getWorkshopParticipants(usersModalWorkshop)
  }, [usersModalWorkshop])

  const filteredParticipants = useMemo(() => {
    return currentWorkshopParticipants.filter(p => {
      const matchesSearch = !usersSearchQuery ||
        p.firstName.toLowerCase().includes(usersSearchQuery.toLowerCase()) ||
        p.lastName.toLowerCase().includes(usersSearchQuery.toLowerCase()) ||
        p.email.toLowerCase().includes(usersSearchQuery.toLowerCase()) ||
        (p.sectionName && p.sectionName.toLowerCase().includes(usersSearchQuery.toLowerCase()))

      const matchesSession = usersSessionFilter === 'all' || p.sessionId === usersSessionFilter
      return matchesSearch && matchesSession
    })
  }, [currentWorkshopParticipants, usersSearchQuery, usersSessionFilter])

  const effectiveWorkshopLocationName = useMemo(() => {
    if (selectedRoomId === '__CUSTOM__') return customLocation || 'Lieu personnalisé'
    if (selectedRoomId) {
      const r = dbRooms.find((room: any) => room.id === selectedRoomId)
      return r?.name || location || 'Salle sélectionnée'
    }
    return location || 'Non défini'
  }, [selectedRoomId, customLocation, location, dbRooms])

  return (
    <div className="workshops-page">
      {/* Search & Filter Toolbar */}
      <div className="workshops-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par titre, salle, lieu, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Tous les types</option>
            <option value="Workshop">🛠️ Workshops</option>
            <option value="Conférences">🎤 Conférences</option>
          </select>

          <select
            value={registrationFilter}
            onChange={(e) => setRegistrationFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Toutes les inscriptions</option>
            <option value="open">🟢 Entrée libre</option>
            <option value="required">📝 Inscription requise</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Toutes les dates</option>
            <option value="upcoming">⏳ À venir / En cours</option>
            <option value="past">🏁 Passés</option>
          </select>

          {hasActiveFilters && (
            <button
              className="btn-reset-filters"
              onClick={() => {
                setSearchQuery('')
                setRegistrationFilter('all')
                setCategoryFilter('all')
                setTimeFilter('all')
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          <span>+ Créer un workshop / conférence</span>
        </button>
      </div>

      {/* Scrollable Container for Workshops */}
      <div className="workshops-content-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Chargement des workshops…</p>
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎨</div>
            {hasActiveFilters ? (
              <>
                <h3>Aucun événement ne correspond à votre recherche</h3>
                <p>Essayez de modifier vos filtres ou termes de recherche.</p>
                <button
                  className="btn-reset-filters-large"
                  onClick={() => {
                    setSearchQuery('')
                    setRegistrationFilter('all')
                    setCategoryFilter('all')
                    setTimeFilter('all')
                  }}
                >
                  Effacer tous les filtres
                </button>
              </>
            ) : (
              <>
                <h3>Aucun workshop ou conférence créé pour le moment</h3>
                <p>Commencez par ajouter le premier événement de la semaine d'intégration.</p>
                <button className="btn-create-workshop" onClick={openCreateModal}>
                  + Créer le premier événement
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="workshops-grid">
            {filteredWorkshops.map((w: Workshop) => {
              const sortedDates = [...(w.dates || [])].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              )
              const participantsList = getWorkshopParticipants(w)
              const displayLocation = w.room?.name || w.location
              const isConference = (w.category || 'Workshop') === 'Conférences'

              return (
                <div key={w.id} className="workshop-card">
                  <div className="workshop-image-container">
                    {w.image ? (
                      <img
                        src={w.image}
                        alt={w.title}
                        className="workshop-image"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="workshop-placeholder-image">
                        <span>{isConference ? '🎤' : '🎨'}</span>
                      </div>
                    )}
                    <div className="workshop-badge-row">
                      <span
                        className="badge"
                        style={{
                          background: isConference ? 'rgba(59, 130, 246, 0.25)' : 'rgba(236, 72, 153, 0.25)',
                          color: isConference ? '#93c5fd' : '#f472b6',
                          border: isConference ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(236, 72, 153, 0.5)',
                          fontWeight: 700,
                        }}
                      >
                        {isConference ? '🎤 Conférence' : '🛠️ Workshop'}
                      </span>
                      {w.isRegistrationClosed ? (
                        <span className="badge badge-registration" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                          🔒 Inscriptions closes
                        </span>
                      ) : w.requiresRegistration ? (
                        w.externalRegistrationUrl ? (
                          <a
                            href={w.externalRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="badge badge-registration"
                            style={{ textDecoration: 'none', background: 'rgba(37, 99, 235, 0.15)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)' }}
                            title="Ouvrir le formulaire externe"
                          >
                            🔗 Formulaire externe ↗
                          </a>
                        ) : (
                          <span className="badge badge-registration">
                            📝 Inscription requise {w.maxParticipants ? `(${w.maxParticipants} max)` : ''}
                          </span>
                        )
                      ) : (
                        <span className="badge badge-open">
                          🟢 Entrée libre
                        </span>
                      )}
                      {w.requiresRegistration && w.onlyOneSlotPerUser && (
                        <span className="badge badge-registration" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                          1 créneau max
                        </span>
                      )}
                      {w.infoUrl && (
                        <a
                          href={w.infoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="badge"
                          style={{
                            textDecoration: 'none',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#6366f1',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            fontWeight: 600,
                          }}
                          title={w.infoDescription ? `Ouvrir : ${w.infoDescription}` : "Ouvrir le lien d'informations"}
                        >
                          🔗 {w.infoDescription || "Plus d'infos"} ↗
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="workshop-details">
                    <h2 className="workshop-title">{w.title}</h2>
                    
                    <div className="workshop-location">
                      📍 <span>{displayLocation}</span>
                      {w.room?.building && (
                        <span style={{ opacity: 0.7, fontSize: '0.85em', marginLeft: '0.35rem' }}>
                          ({w.room.building})
                        </span>
                      )}
                    </div>

                    <p className="workshop-description">{w.description}</p>

                    <div className="workshop-dates-section">
                      <h3 className="workshop-dates-title">
                        Sessions ({sortedDates.length})
                      </h3>
                      <div className="workshop-dates-list">
                        {sortedDates.length === 0 ? (
                          <span className="no-sessions">Aucune session définie</span>
                        ) : (
                          sortedDates.map((d: any) => {
                            const slotLoc = d.room?.name || d.location
                            const hasCustomRoom = slotLoc && slotLoc !== displayLocation

                            return (
                              <div key={d.id} className="workshop-date-chip">
                                📅 {formatDateTimeRange(d.startTime, d.endTime)}
                                {hasCustomRoom && (
                                  <span className="workshop-session-room-tag">
                                    📍 {slotLoc}
                                  </span>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="workshop-actions">
                      <button
                        className="btn-icon btn-participants"
                        onClick={() => openUsersModal(w)}
                        title="Voir les inscrits"
                      >
                        👥 Inscrits ({participantsList.length})
                      </button>
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => openEditModal(w)}
                        title="Modifier"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(w.id, w.title)}
                        title="Supprimer"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal workshop-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editingWorkshop ? 'Modifier le workshop' : 'Créer un workshop'}</h2>
              <button className="modal-close-btn" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {hasConflictErrors && (
                <div className="conflicts-summary-banner">
                  <span>⚠️</span>
                  <span>Des conflits d'occupation de salle ont été détectés sur une ou plusieurs sessions. Veuillez vérifier les détails ci-dessous.</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 250px' }}>
                  <label>
                    Titre *
                    <input
                      type="text"
                      required
                      placeholder="Ex: Conférence IA & Futur, Workshop Git..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <label>
                    Catégorie *
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      style={{
                        padding: '0.65rem 0.85rem',
                        background: 'var(--ws-bg-input)',
                        border: '1px solid rgba(238, 212, 241, 0.2)',
                        borderRadius: '0.6rem',
                        color: '#ffffff',
                        fontWeight: 600,
                        width: '100%',
                      }}
                    >
                      <option value="Workshop">🛠️ Workshop / Atelier</option>
                      <option value="Conférences">🎤 Conférence / Conférences</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Room Picker Section */}
              <div className="form-group-full">
                <label className="field-label">
                  Salle principale du workshop (par défaut pour les sessions) *
                </label>
                <div className="room-picker-container">
                  <select
                    className="room-select-input"
                    value={selectedRoomId}
                    onChange={(e) => handleMainRoomChange(e.target.value)}
                  >
                    <option value="">-- Choisir une salle de la base de données --</option>
                    {dbRooms.map((r: any) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.building ? `(${r.building})` : ''} {r.capacity ? `• Capacité: ${r.capacity}` : ''} {r.isComputerRoom ? '• [Info]' : ''}
                      </option>
                    ))}
                    <option value="__CUSTOM__">✍️ Autre salle / Lieu personnalisé...</option>
                  </select>

                  {selectedRoomId === '__CUSTOM__' && (
                    <input
                      type="text"
                      required
                      placeholder="Ex: Rolex Learning Center, Forum RLC, etc."
                      value={customLocation}
                      onChange={(e) => {
                        setCustomLocation(e.target.value)
                        setLocation(e.target.value)
                      }}
                      className="custom-location-input"
                      style={{
                        padding: '0.6rem 0.8rem',
                        background: 'var(--ws-bg-input)',
                        border: '1px solid rgba(238, 212, 241, 0.2)',
                        borderRadius: '0.6rem',
                        color: '#ffffff',
                      }}
                    />
                  )}
                </div>
              </div>

              <label>
                Description *
                <textarea
                  required
                  rows={4}
                  placeholder="Décrivez le workshop"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <label>
                  Lien d'information supplémentaire (optionnel)
                  <input
                    type="url"
                    placeholder="https://... (ex: site web, ressources, slides)"
                    value={infoUrl}
                    onChange={(e) => setInfoUrl(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    URL du lien externe pour cet atelier.
                  </span>
                </label>

                <label>
                  Texte / description du lien (optionnel)
                  <input
                    type="text"
                    placeholder="Ex: Slides du cours, Dépôt GitHub..."
                    value={infoDescription}
                    onChange={(e) => setInfoDescription(e.target.value)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                    Libellé affiché sur le bouton (par défaut : « Plus d'infos »).
                  </span>
                </label>
              </div>

              <div className="modal-registration-box">
                <span className="modal-section-title">Options d'inscription</span>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={requiresRegistration}
                    onChange={(e) => {
                      setRequiresRegistration(e.target.checked)
                      if (!e.target.checked) {
                        setMaxParticipants('')
                        setExternalRegistrationUrl('')
                        setOnlyOneSlotPerUser(false)
                      }
                    }}
                  />
                  <span>Requiert une inscription préalable</span>
                </label>

                {requiresRegistration && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label className="checkbox-label" style={{ marginLeft: '1.25rem' }}>
                      <input
                        type="checkbox"
                        checked={onlyOneSlotPerUser}
                        onChange={(e) => setOnlyOneSlotPerUser(e.target.checked)}
                      />
                      <span>Limiter à 1 seul créneau par participant pour cet atelier</span>
                    </label>

                    <label className="sub-label">
                      Lien vers un formulaire externe (Google Forms, Typeform, etc.)
                      <input
                        type="url"
                        placeholder="https://forms.gle/... (laisser vide pour inscription sur l'app)"
                        value={externalRegistrationUrl}
                        onChange={(e) => setExternalRegistrationUrl(e.target.value)}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                        Si renseigné, le bouton d'inscription dans l'application renverra directement vers ce formulaire externe.
                      </span>
                    </label>

                    {!externalRegistrationUrl && (
                      <label className="sub-label">
                        Nombre maximal de participants par créneau sur l'application (laisser vide si illimité)
                        <input
                          type="number"
                          min={1}
                          placeholder="Ex: 25"
                          value={maxParticipants}
                          onChange={(e) => setMaxParticipants(e.target.value !== '' ? Number(e.target.value) : '')}
                        />
                      </label>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--ws-border)', paddingTop: '0.75rem' }}>
                  <label className="checkbox-label" style={{ color: isRegistrationClosed ? '#f87171' : 'inherit' }}>
                    <input
                      type="checkbox"
                      checked={isRegistrationClosed}
                      onChange={(e) => setIsRegistrationClosed(e.target.checked)}
                    />
                    <span>🔒 Clôturer les inscriptions (l'atelier reste visible mais les inscriptions sont bloquées)</span>
                  </label>
                </div>
              </div>

              {/* Image Input Section */}
              <div className="modal-image-box">
                <div className="modal-image-header">
                  <span className="modal-section-title">Image du workshop</span>
                  <div className="image-tab-buttons">
                    <button
                      type="button"
                      className={`tab-btn ${imageTab === 'file' ? 'active' : ''}`}
                      onClick={() => setImageTab('file')}
                    >
                      Fichier / Fait glisser
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${imageTab === 'url' ? 'active' : ''}`}
                      onClick={() => setImageTab('url')}
                    >
                      Lien URL
                    </button>
                  </div>
                </div>

                {image ? (
                  <div className="image-preview-container">
                    <img src={image} alt="Aperçu workshop" />
                    <button
                      type="button"
                      className="btn-remove-image"
                      onClick={() => setImage('')}
                      title="Supprimer l'image"
                    >
                      ✕
                    </button>
                  </div>
                ) : imageTab === 'url' ? (
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="url-image-input"
                  />
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`dropzone ${isDragging ? 'dragging' : ''}`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="file-input-overlay"
                      onChange={handleImageChange}
                    />
                    <span className="dropzone-icon">📷</span>
                    <span className="dropzone-text">
                      Glissez-déposez une image ici ou cliquez pour choisir
                    </span>
                    <span className="dropzone-subtext">
                      Format PNG, JPG, WebP (max 2 Mo)
                    </span>
                  </div>
                )}
              </div>

              {/* Dates / Sessions Section */}
              <div className="modal-dates-manager">
                <div className="modal-dates-header">
                  <span className="modal-section-title">Sessions du workshop *</span>
                  <button
                    type="button"
                    className="btn-add-date"
                    onClick={handleAddDate}
                  >
                    + Ajouter une session
                  </button>
                </div>

                <div className="dates-list-container">
                  {dates.map((d, index) => {
                    const currentSlotConflicts = slotConflicts.filter((c: any) => c.slotIndex === index)
                    const hasErrors = currentSlotConflicts.some((c: any) => c.severity === 'ERROR')
                    const hasWarnings = currentSlotConflicts.some((c: any) => c.severity === 'WARNING')

                    const assignedRoomOrLoc = d.roomId === '__CUSTOM__'
                      ? (d.customLocation || 'Lieu personnalisé')
                      : (d.roomId ? (dbRooms.find((r: any) => r.id === d.roomId)?.name || 'Salle') : effectiveWorkshopLocationName)

                    return (
                      <div key={index} className="date-input-card">
                        <div className="date-input-header">
                          <span className="session-index-badge">Session #{index + 1}</span>
                          {dates.length > 1 && (
                            <button
                              type="button"
                              className="btn-remove-date"
                              onClick={() => handleRemoveDate(index)}
                            >
                              Supprimer
                            </button>
                          )}
                        </div>

                        <div className="date-input-fields">
                          <label>
                            Début
                            <input
                              type="datetime-local"
                              required
                              value={d.startTime}
                              onChange={(e) => handleDateChange(index, 'startTime', e.target.value)}
                            />
                          </label>

                          <label>
                            Fin
                            <input
                              type="datetime-local"
                              required
                              value={d.endTime}
                              onChange={(e) => handleDateChange(index, 'endTime', e.target.value)}
                            />
                          </label>
                        </div>

                        {/* Per-Slot Room Picker */}
                        <div className="slot-room-row">
                          <div className="slot-room-header">
                            <span>Salle spécifique pour cette session :</span>
                          </div>
                          <select
                            className="room-select-input"
                            value={d.roomId || ''}
                            onChange={(e) => handleSlotRoomChange(index, e.target.value)}
                            style={{ fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
                          >
                            <option value="">
                              Même salle que le workshop ({effectiveWorkshopLocationName})
                            </option>
                            {dbRooms.map((r: any) => (
                              <option key={r.id} value={r.id}>
                                {r.name} {r.building ? `(${r.building})` : ''} {r.capacity ? `• Capacité: ${r.capacity}` : ''}
                              </option>
                            ))}
                            <option value="__CUSTOM__">✍️ Autre salle spécifique...</option>
                          </select>

                          {d.roomId === '__CUSTOM__' && (
                            <input
                              type="text"
                              placeholder="Ex: Salle SG 123"
                              value={d.customLocation || ''}
                              onChange={(e) => {
                                const updated = [...dates]
                                updated[index] = {
                                  ...updated[index],
                                  customLocation: e.target.value,
                                  location: e.target.value,
                                }
                                setDates(updated)
                              }}
                              style={{
                                padding: '0.45rem 0.65rem',
                                background: 'var(--ws-bg-input)',
                                border: '1px solid rgba(238, 212, 241, 0.2)',
                                borderRadius: '0.45rem',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                marginTop: '0.25rem',
                              }}
                            />
                          )}
                        </div>

                        {/* Real-time Conflict Indicators */}
                        {currentSlotConflicts.length > 0 ? (
                          <div className="slot-conflicts-container">
                            {currentSlotConflicts.map((conf: any, cIdx: number) => (
                              <div
                                key={cIdx}
                                className={`conflict-badge ${conf.severity === 'ERROR' ? 'error' : 'warning'}`}
                              >
                                <span className="conflict-icon">
                                  {conf.severity === 'ERROR' ? '🚫' : '⚠️'}
                                </span>
                                <span className="conflict-text">{conf.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : assignedRoomOrLoc && assignedRoomOrLoc !== 'Non défini' && d.startTime && d.endTime ? (
                          <div className="slot-conflicts-container">
                            <div className="conflict-badge ok">
                              <span className="conflict-icon">✓</span>
                              <span className="conflict-text">
                                Salle {assignedRoomOrLoc} disponible sur ce créneau (aucun conflit détecté)
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participants List Modal */}
      {usersModalWorkshop && (
        <div className="modal-overlay" onClick={() => setUsersModalWorkshop(null)}>
          <div className="modal participants-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group">
                <h2>👥 Liste des participants inscrits</h2>
                <p className="modal-subtitle">{usersModalWorkshop.title} - 📍 {usersModalWorkshop.location}</p>
              </div>
              <button className="close-btn" onClick={() => setUsersModalWorkshop(null)}>✕</button>
            </div>

            <div className="modal-body participants-modal-body">
              {/* Stat Summary Bar */}
              <div className="participants-summary-bar">
                <div className="summary-stat">
                  <span className="stat-label">Inscrits totaux</span>
                  <span className="stat-val">
                    {currentWorkshopParticipants.length} {usersModalWorkshop.maxParticipants ? `/ ${usersModalWorkshop.maxParticipants} max` : ''}
                  </span>
                </div>
              </div>

              {/* Toolbar */}
              <div className="participants-toolbar">
                <div className="search-box">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email, section..."
                    value={usersSearchQuery}
                    onChange={(e) => setUsersSearchQuery(e.target.value)}
                  />
                  {usersSearchQuery && (
                    <button className="clear-search-btn" onClick={() => setUsersSearchQuery('')}>✕</button>
                  )}
                </div>

                <select
                  value={usersSessionFilter}
                  onChange={(e) => setUsersSessionFilter(e.target.value)}
                  className="participants-select-filter"
                >
                  <option value="all">Toutes les sessions ({usersModalWorkshop.dates.length})</option>
                  {usersModalWorkshop.dates.map((d, idx) => (
                    <option key={d.id} value={d.id}>
                      Session #{idx + 1}: {formatDateTimeRange(d.startTime, d.endTime)}
                    </option>
                  ))}
                </select>

                <button
                  className="btn-export-csv"
                  onClick={() => exportParticipantsCSV(usersModalWorkshop, filteredParticipants)}
                  title="Exporter la liste en CSV"
                >
                  📥 Exporter CSV
                </button>
              </div>

              {/* Manual Add Form */}
              {showAddParticipantForm ? (
                <form className="quick-add-participant-form" onSubmit={handleAddParticipantSubmit}>
                  <h4>➕ Inscrire un étudiant de la base de données</h4>

                  {/* Student Search & Select */}
                  <div className="form-group-full">
                    <label className="field-label">Rechercher et choisir l'étudiant :</label>
                    <div className="search-box mb-2">
                      <span className="search-icon">🔍</span>
                      <input
                        type="text"
                        placeholder="Rechercher par prénom, nom, email ou section..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                      />
                      {studentSearchQuery && (
                        <button className="clear-search-btn" type="button" onClick={() => setStudentSearchQuery('')}>
                          ✕
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="participants-select-filter full-width"
                      required
                    >
                      <option value="">-- Sélectionner un étudiant ({filteredDbStudents.length} trouvés) --</option>
                      {filteredDbStudents.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} — {s.email} ({s.section?.name || 'N/A'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Slot / Session Select */}
                  <div className="form-group-full">
                    <label className="field-label">Sélectionner le créneau / session :</label>
                    <select
                      value={selectedSlotId || (usersSessionFilter !== 'all' ? usersSessionFilter : (usersModalWorkshop.dates[0]?.id || ''))}
                      onChange={(e) => setSelectedSlotId(e.target.value)}
                      className="participants-select-filter full-width"
                      required
                    >
                      {usersModalWorkshop.dates.map((d, idx) => (
                        <option key={d.id} value={d.id}>
                          📅 Créneau #{idx + 1} : {formatDateTimeRange(d.startTime, d.endTime)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-actions-inline">
                    <button type="submit" className="btn-save" disabled={!selectedStudentId}>
                      ➕ Inscrire à la session
                    </button>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setShowAddParticipantForm(false)
                        setSelectedStudentId('')
                        setSelectedSlotId('')
                        setStudentSearchQuery('')
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              ) : (
                <button className="btn-add-participant-trigger" onClick={() => setShowAddParticipantForm(true)}>
                  + Inscrire un étudiant manuellement
                </button>
              )}

              {/* Table */}
              <div className="participants-table-container">
                {filteredParticipants.length === 0 ? (
                  <div className="empty-participants-state">
                    <p>Aucun participant inscrit trouvé.</p>
                  </div>
                ) : (
                  <table className="participants-table">
                    <thead>
                      <tr>
                        <th>Participant</th>
                        <th>Email</th>
                        <th>Section</th>
                        <th>Session</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div className="participant-user-info">
                              <div className="avatar-circle">
                                {p.firstName[0]}{p.lastName[0]}
                              </div>
                              <span className="participant-name">{p.firstName} {p.lastName}</span>
                            </div>
                          </td>
                          <td className="cell-email">{p.email}</td>
                          <td>
                            <span className="badge-section">{p.sectionName || 'N/A'}</span>
                          </td>
                          <td className="cell-session">
                            {p.sessionTime ? (
                              <span className="session-tag">📅 {p.sessionTime}</span>
                            ) : (
                              <span className="session-tag">Toutes sessions</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn-remove-participant"
                              onClick={() => removeParticipant(usersModalWorkshop.id, p.id)}
                              title="Désinscrire cet étudiant"
                            >
                              ✕ Désinscrire
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setUsersModalWorkshop(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

