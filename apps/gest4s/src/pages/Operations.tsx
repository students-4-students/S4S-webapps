import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import {
  Modal,
  Button,
  Input,
  Select,
  SearchInput,
  Badge,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  MultiSelectCombobox,
  formatDateTimeRange,
  toLocalDatetimeString,
  toISOStringFromLocal,
} from '@s4s/ui'
import CreateIncidentModal from '../components/CreateIncidentModal'

type ViewMode = 'board' | 'timeline' | 'list'

const POLES = [
  { key: 'LOGISTIQUE', label: 'Logistique', icon: '🚚', color: '#6366f1' },
  { key: 'MATERIEL', label: 'Matériel', icon: '📦', color: '#06b6d4' },
  { key: 'ANIMATION', label: 'Animation', icon: '🎉', color: '#10b981' },
  { key: 'PEDAGOGIE', label: 'Pédagogie', icon: '📚', color: '#f59e0b' },
  { key: 'COMMUNICATION', label: 'Communication', icon: '📢', color: '#ec4899' },
] as const

const DAYS = [
  { dateStr: '2026-08-26', label: 'Mer 26 août' },
  { dateStr: '2026-08-27', label: 'Jeu 27 août' },
  { dateStr: '2026-08-28', label: 'Ven 28 août' },
  { dateStr: '2026-08-29', label: 'Sam 29 août' },
  { dateStr: '2026-08-31', label: 'Lun 31 août' },
  { dateStr: '2026-09-01', label: 'Mar 1 sep' },
  { dateStr: '2026-09-02', label: 'Mer 2 sep' },
  { dateStr: '2026-09-03', label: 'Jeu 3 sep' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'neutral' | 'warning' | 'success' | 'danger' }> = {
  PENDING: { label: 'À faire', variant: 'neutral' },
  IN_PROGRESS: { label: 'En cours', variant: 'warning' },
  DONE: { label: 'Terminé', variant: 'success' },
  CANCELLED: { label: 'Annulé', variant: 'danger' },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Faible', color: '#10b981' },
  MEDIUM: { label: 'Normale', color: '#3b82f6' },
  HIGH: { label: 'Haute', color: '#f59e0b' },
  URGENT: { label: 'Urgent 🚨', color: '#ef4444' },
}

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

function getTaskDayBadge(startTime: Date | string) {
  const d = typeof startTime === 'string' ? new Date(startTime) : startTime
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const isoDate = `${year}-${month}-${day}`
  const found = DAYS.find((item) => item.dateStr === isoDate)
  if (found) return found.label
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric' })
}

function calculateTaskTimelineBounds(startTime: Date | string, endTime: Date | string, hourWidth: number = 80) {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime

  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()

  const timelineStartMin = 7 * 60 // 07:00
  const timelineEndMin = 22 * 60 // 22:00

  const clampedStart = Math.max(timelineStartMin, Math.min(timelineEndMin, startMin))
  const clampedEnd = Math.max(timelineStartMin, Math.min(timelineEndMin, endMin))

  const leftPx = ((clampedStart - timelineStartMin) / 60) * hourWidth
  const widthPx = Math.max(60, ((clampedEnd - clampedStart) / 60) * hourWidth)

  return { left: `${leftPx}px`, width: `${widthPx}px` }
}

function assignTaskTracks(tasks: any[]) {
  if (tasks.length === 0) return { tasksWithTracks: [], numTracks: 1 }

  const tasksWithMins = tasks.map((t) => {
    const s = typeof t.startTime === 'string' ? new Date(t.startTime) : t.startTime
    const e = typeof t.endTime === 'string' ? new Date(t.endTime) : t.endTime

    const startMin = s.getHours() * 60 + s.getMinutes()
    let endMin = e.getHours() * 60 + e.getMinutes()
    if (endMin <= startMin) endMin = startMin + 30

    return {
      task: t,
      startMin,
      endMin,
      dateMs: s.getTime(),
    }
  })

  tasksWithMins.sort((a, b) => {
    if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs
    return a.startMin - b.startMin
  })

  const tracks: { startMin: number; endMin: number }[][] = []
  const tasksWithTracks: (any & { trackIndex: number })[] = []

  for (const item of tasksWithMins) {
    let assignedTrack = -1

    for (let tIdx = 0; tIdx < tracks.length; tIdx++) {
      const trackRanges = tracks[tIdx]
      const overlaps = trackRanges.some(
        (r) => Math.max(r.startMin, item.startMin) < Math.min(r.endMin, item.endMin)
      )

      if (!overlaps) {
        assignedTrack = tIdx
        trackRanges.push({ startMin: item.startMin, endMin: item.endMin })
        break
      }
    }

    if (assignedTrack === -1) {
      assignedTrack = tracks.length
      tracks.push([{ startMin: item.startMin, endMin: item.endMin }])
    }

    tasksWithTracks.push({
      ...item.task,
      trackIndex: assignedTrack,
    })
  }

  return { tasksWithTracks, numTracks: Math.max(1, tracks.length) }
}

export default function Operations() {
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDay, setSelectedDay] = useState<string>('all')
  const [selectedPole, setSelectedPole] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedPriority, setSelectedPriority] = useState<string>('all')

  // Modal States
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [showIncidentModal, setShowIncidentModal] = useState(false)
  const [incidentPrefill, setIncidentPrefill] = useState<{ title?: string; location?: string }>({})

  // Task Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<typeof POLES[number]['key']>('LOGISTIQUE')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
  const [status, setStatus] = useState<'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>('PENDING')
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([])

  const utils = trpc.useUtils()

  // Queries
  const { data: tasks = [], isLoading: loadingTasks } = trpc.tasks.list.useQuery()
  const { data: staffs = [] } = trpc.staffs.list.useQuery()

  // Live updates
  trpc.tasks.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.tasks.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Operations subscription error:', err)
    },
  })

  const createMutation = trpc.tasks.create.useMutation()
  const updateMutation = trpc.tasks.update.useMutation()
  const deleteMutation = trpc.tasks.delete.useMutation()

  // Pre-fill datetime defaults
  const openCreateModal = (defaultCategory?: typeof POLES[number]['key']) => {
    setEditingTask(null)
    setName('')
    setDescription('')
    setCategory(defaultCategory || 'LOGISTIQUE')
    setLocation('')
    setPriority('MEDIUM')
    setStatus('PENDING')
    setAssignedStaffIds([])

    const now = new Date()
    const targetDate = selectedDay !== 'all' ? new Date(`${selectedDay}T09:00:00`) : now
    const twoHoursLater = new Date(targetDate.getTime() + 2 * 60 * 60 * 1000)

    setStartTime(toLocalDatetimeString(targetDate))
    setEndTime(toLocalDatetimeString(twoHoursLater))
    setShowTaskModal(true)
  }

  const openEditModal = (task: any) => {
    setEditingTask(task)
    setName(task.name)
    setDescription(task.description || '')
    setCategory(task.category)
    setStartTime(toLocalDatetimeString(task.startTime))
    setEndTime(toLocalDatetimeString(task.endTime))
    setLocation(task.location || '')
    setPriority(task.priority || 'MEDIUM')
    setStatus(task.status || 'PENDING')
    setAssignedStaffIds(task.assignments?.map((a: any) => a.staffMemberId) || [])
    setShowTaskModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startTime || !endTime) {
      alert('Veuillez spécifier l’heure de début et de fin.')
      return
    }

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        startTime: toISOStringFromLocal(startTime),
        endTime: toISOStringFromLocal(endTime),
        location: location.trim() || undefined,
        priority,
        status,
        assignedStaffIds,
      }

      if (editingTask) {
        await updateMutation.mutateAsync({
          id: editingTask.id,
          ...payload,
        })
      } else {
        await createMutation.mutateAsync(payload)
      }

      utils.tasks.list.invalidate()
      setShowTaskModal(false)
    } catch (err: any) {
      alert('Erreur: ' + (err.message || err))
    }
  }

  const handleInlineStatusChange = async (taskId: string, newStatus: any) => {
    try {
      await updateMutation.mutateAsync({
        id: taskId,
        status: newStatus,
      })
      utils.tasks.list.invalidate()
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string, taskName: string) => {
    if (window.confirm(`Supprimer la tâche "${taskName}" ?`)) {
      await deleteMutation.mutateAsync({ id })
      utils.tasks.list.invalidate()
    }
  }

  const handleCreateIncident = (task: any) => {
    setIncidentPrefill({
      title: `Incident lors de: ${task.name}`,
      location: task.location || '',
    })
    setShowTaskModal(false)
    setShowIncidentModal(true)
  }

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.location && t.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const taskDateStr = new Date(t.startTime).toISOString().split('T')[0]
      const matchesDay = selectedDay === 'all' || taskDateStr === selectedDay
      const matchesPole = selectedPole === 'all' || t.category === selectedPole
      const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus
      const matchesPriority = selectedPriority === 'all' || t.priority === selectedPriority

      return matchesSearch && matchesDay && matchesPole && matchesStatus && matchesPriority
    })
  }, [tasks, searchQuery, selectedDay, selectedPole, selectedStatus, selectedPriority])

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedDay !== 'all' ||
    selectedPole !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPriority !== 'all'

  const resetFilters = () => {
    setSearchQuery('')
    setSelectedDay('all')
    setSelectedPole('all')
    setSelectedStatus('all')
    setSelectedPriority('all')
  }

  return (
    <div className="operations-page" style={{ padding: '1.5rem', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <PageHeader
        title="Opérations & Pôles"
        subtitle="Organisation et suivi des tâches par pôle opérationnel"
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--s4s-bg-subtle)', padding: '0.25rem', borderRadius: 'var(--s4s-radius-md)', border: '1px solid var(--s4s-border)' }}>
              <button
                type="button"
                className={`s4s-button s4s-button--sm ${viewMode === 'board' ? 's4s-button--primary' : 's4s-button--ghost'}`}
                onClick={() => setViewMode('board')}
              >
                📊 Tableau
              </button>
              <button
                type="button"
                className={`s4s-button s4s-button--sm ${viewMode === 'timeline' ? 's4s-button--primary' : 's4s-button--ghost'}`}
                onClick={() => setViewMode('timeline')}
              >
                🕒 Planning
              </button>
              <button
                type="button"
                className={`s4s-button s4s-button--sm ${viewMode === 'list' ? 's4s-button--primary' : 's4s-button--ghost'}`}
                onClick={() => setViewMode('list')}
              >
                📋 Liste
              </button>
            </div>

            <Button variant="primary" onClick={() => openCreateModal()}>
              + Nouvelle tâche
            </Button>
          </div>
        }
      />

      {/* Filter Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {/* Day Selector Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <button
            type="button"
            className={`s4s-button s4s-button--sm ${selectedDay === 'all' ? 's4s-button--primary' : 's4s-button--secondary'}`}
            onClick={() => setSelectedDay('all')}
          >
            Tous les jours
          </button>
          {DAYS.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              className={`s4s-button s4s-button--sm ${selectedDay === d.dateStr ? 's4s-button--primary' : 's4s-button--secondary'}`}
              onClick={() => setSelectedDay(d.dateStr)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Search and Secondary Selects */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <SearchInput
              placeholder="Rechercher une tâche, lieu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
            />
          </div>

          <div style={{ width: '170px' }}>
            <Select value={selectedPole} onChange={(e) => setSelectedPole(e.target.value)}>
              <option value="all">Tous les pôles</option>
              {POLES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.icon} {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ width: '160px' }}>
            <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="PENDING">À faire</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="DONE">Terminé</option>
              <option value="CANCELLED">Annulé</option>
            </Select>
          </div>

          <div style={{ width: '160px' }}>
            <Select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}>
              <option value="all">Toutes priorités</option>
              <option value="LOW">Faible</option>
              <option value="MEDIUM">Normale</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgent 🚨</option>
            </Select>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Effacer les filtres
            </Button>
          )}
        </div>
      </div>

      {/* Main View Content */}
      {loadingTasks ? (
        <LoadingSpinner label="Chargement des tâches opérationnelles..." />
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Aucune tâche trouvée"
          description={hasActiveFilters ? "Essayez de modifier vos filtres." : "Ajoutez la première tâche opérationnelle de la semaine."}
          actionLabel="+ Créer une tâche"
          onAction={() => openCreateModal()}
        />
      ) : viewMode === 'board' ? (
        /* Board View (Columns by Pôle) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          {POLES.filter((p) => selectedPole === 'all' || selectedPole === p.key).map((pole) => {
            const poleTasks = filteredTasks.filter((t) => t.category === pole.key)

            return (
              <div
                key={pole.key}
                style={{
                  background: 'var(--s4s-bg-card)',
                  borderRadius: 'var(--s4s-radius-lg)',
                  border: '1px solid var(--s4s-border)',
                  boxShadow: 'var(--s4s-shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 260px)',
                  overflow: 'hidden',
                }}
              >
                {/* Column Header */}
                <div
                  style={{
                    padding: '0.875rem 1rem',
                    borderBottom: '1px solid var(--s4s-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--s4s-bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--s4s-text-primary)' }}>
                    <span style={{ fontSize: '1.1rem' }}>{pole.icon}</span>
                    <span>{pole.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Badge variant="neutral">{poleTasks.length}</Badge>
                    <button
                      type="button"
                      onClick={() => openCreateModal(pole.key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--s4s-primary)' }}
                      title="Ajouter dans ce pôle"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Column Tasks List */}
                <div style={{ padding: '0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  {poleTasks.length === 0 ? (
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--s4s-text-muted)', margin: '1.5rem 0' }}>
                      Aucune tâche dans ce pôle
                    </p>
                  ) : (
                    poleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={() => openEditModal(task)}
                        onDelete={() => handleDelete(task.id, task.name)}
                        onStatusChange={(newStatus) => handleInlineStatusChange(task.id, newStatus)}
                        onCreateIncident={() => handleCreateIncident(task)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : viewMode === 'timeline' ? (
        /* Timeline Grid View - Pixel-aligned to time columns with day badges */
        <div
          style={{
            background: 'var(--s4s-bg-card)',
            borderRadius: 'var(--s4s-radius-lg)',
            border: '1px solid var(--s4s-border)',
            padding: '1rem',
            overflowX: 'auto',
            boxShadow: 'var(--s4s-shadow-sm)',
          }}
        >
          <div style={{ minWidth: '1350px' }}>
            {/* Hour Header Bar */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '150px repeat(15, 80px)',
                borderBottom: '2px solid var(--s4s-border)',
                paddingBottom: '0.5rem',
                background: 'var(--s4s-bg-subtle)',
                borderRadius: 'var(--s4s-radius-md) var(--s4s-radius-md) 0 0',
                alignItems: 'center',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--s4s-text-primary)', paddingLeft: '0.75rem' }}>
                Pôle
              </div>
              {HOURS.slice(0, 15).map((h) => (
                <div key={h} style={{ textAlign: 'left', fontSize: '0.75rem', color: 'var(--s4s-text-muted)', fontWeight: 700, paddingLeft: '4px', borderLeft: '1px solid var(--s4s-border)' }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Rows per Pole with Vertical Hour Grid Background */}
            {POLES.filter((p) => selectedPole === 'all' || selectedPole === p.key).map((pole) => {
              const poleTasks = filteredTasks.filter((t) => t.category === pole.key)
              const { tasksWithTracks, numTracks } = assignTaskTracks(poleTasks)
              const trackHeight = 52 // Height per sub-line for 2-line cards
              const rowHeight = Math.max(70, numTracks * trackHeight + 16)

              return (
                <div
                  key={pole.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '150px 1200px',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--s4s-border)',
                    height: `${rowHeight}px`,
                    position: 'relative',
                  }}
                >
                  {/* Pole Sidebar Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem', paddingLeft: '0.75rem' }}>
                    <span>{pole.icon}</span>
                    <span>{pole.label}</span>
                  </div>

                  {/* Timeline Track Area (1200px wide = 15 hours * 80px) */}
                  <div
                    style={{
                      position: 'relative',
                      height: '100%',
                      width: '100%',
                    }}
                  >
                    {/* Background Hour Grid Lines */}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(15, 80px)', pointerEvents: 'none' }}>
                      {HOURS.slice(0, 15).map((h) => (
                        <div key={h} style={{ borderLeft: '1px solid var(--s4s-border)', height: '100%', opacity: 0.5 }} />
                      ))}
                    </div>

                    {/* Task Blocks stacked across sub-tracks according to start/end time and trackIndex */}
                    {tasksWithTracks.length === 0 ? (
                      <span style={{ position: 'absolute', top: '22px', fontSize: '0.75rem', color: 'var(--s4s-text-muted)', fontStyle: 'italic', paddingLeft: '1rem', zIndex: 1 }}>
                        Aucune tâche
                      </span>
                    ) : (
                      tasksWithTracks.map((t) => {
                        const bounds = calculateTaskTimelineBounds(t.startTime, t.endTime, 80)
                        const dayBadge = getTaskDayBadge(t.startTime)
                        const topPx = t.trackIndex * trackHeight + 8

                        return (
                          <div
                            key={t.id}
                            onClick={() => openEditModal(t)}
                            title={`${t.name} (${dayBadge} ${new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(t.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})\nLieu: ${t.location || 'N/A'}`}
                            style={{
                              position: 'absolute',
                              left: bounds.left,
                              width: bounds.width,
                              top: `${topPx}px`,
                              height: '44px',
                              background: pole.color + '22',
                              borderLeft: `4px solid ${pole.color}`,
                              border: `1px solid ${pole.color}44`,
                              borderLeftWidth: '4px',
                              padding: '0.25rem 0.45rem',
                              borderRadius: 'var(--s4s-radius-sm)',
                              cursor: 'pointer',
                              zIndex: 2,
                              boxShadow: 'var(--s4s-shadow-sm)',
                              transition: 'transform 100ms ease, box-shadow 100ms ease',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: '2px',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Line 1: Date Pill Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
                              <span
                                style={{
                                  fontSize: '0.63rem',
                                  fontWeight: 700,
                                  background: pole.color,
                                  color: 'white',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: 'var(--s4s-radius-sm)',
                                  lineHeight: '1.2',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {dayBadge}
                              </span>
                            </div>

                            {/* Line 2: Title and Time */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflow: 'hidden', width: '100%', fontSize: '0.75rem' }}>
                              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</strong>
                              <span style={{ fontSize: '0.68rem', opacity: 0.8, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                ({new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="s4s-table-card">
          <div className="s4s-table-container">
            <table className="s4s-table">
              <thead>
                <tr>
                  <th>Tâche</th>
                  <th>Pôle</th>
                  <th>Horaires</th>
                  <th>Lieu</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Assigné(s)</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const poleInfo = POLES.find((p) => p.key === task.category)
                  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['MEDIUM']
                  const statusInfo = STATUS_CONFIG[task.status] || STATUS_CONFIG['PENDING']

                  return (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.name}</strong>
                        {task.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--s4s-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>
                            {task.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge variant="purple">
                          {poleInfo?.icon} {poleInfo?.label || task.category}
                        </Badge>
                      </td>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {formatDateTimeRange(task.startTime, task.endTime)}
                      </td>
                      <td>{task.location || '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: priorityInfo.color }}>
                          {priorityInfo.label}
                        </span>
                      </td>
                      <td>
                        <Badge variant={statusInfo.variant} showDot>
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td>
                        {task.assignments?.length ? (
                          task.assignments.map((a: any) => `${a.staffMember.firstName} ${a.staffMember.lastName}`).join(', ')
                        ) : (
                          <span style={{ color: 'var(--s4s-text-muted)' }}>Non assigné</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <Button variant="ghost" size="sm" onClick={() => openEditModal(task)} title="Modifier">
                          ✏️
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCreateIncident(task)} title="Signaler un incident">
                          🚨
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(task.id, task.name)} title="Supprimer">
                          🗑️
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Link to="/" style={{ marginTop: '1.5rem', display: 'inline-block', color: 'var(--s4s-primary)', fontWeight: 600, textDecoration: 'none' }}>
        ← Dashboard
      </Link>

      {/* Task Creation & Edit Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={editingTask ? 'Modifier la tâche' : 'Nouvelle tâche opérationnelle'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="Nom de la tâche"
            required
            placeholder="Ex: Mise en place des tables, Distribution badges"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="s4s-form-field">
            <label className="s4s-label">Pôle (Catégorie) *</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
              {POLES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.icon} {p.label}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Début"
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Fin"
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <Input
            label="Lieu"
            placeholder="Ex: Hall SG, Esplanade"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <Select label="Priorité" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                <option value="LOW">Faible</option>
                <option value="MEDIUM">Normale</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgent 🚨</option>
              </Select>
            </div>
            <div style={{ flex: 1 }}>
              <Select label="Statut" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="PENDING">À faire</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="DONE">Terminé</option>
                <option value="CANCELLED">Annulé</option>
              </Select>
            </div>
          </div>

          {/* Assigned Staff Members */}
          <MultiSelectCombobox
            label="Staffs assignés"
            placeholder="Rechercher par nom, prénom ou rôle (ex: Alex, Logistique, RC)..."
            options={staffs.map((st) => ({
              id: st.id,
              label: `${st.firstName} ${st.lastName}`,
              sublabel: st.role,
              category: st.role,
            }))}
            selectedIds={assignedStaffIds}
            onChange={setAssignedStaffIds}
            categories={Array.from(
              new Set(
                staffs.flatMap((st) => (st.role ? st.role.split(',').map((r) => r.trim()) : []))
              )
            )}
          />

          <div className="s4s-form-field">
            <label className="s4s-label">Description / Consignes</label>
            <textarea
              rows={3}
              className="s4s-textarea"
              placeholder="Détails, instructions ou matériel à prendre..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            {editingTask ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCreateIncident(editingTask)}
              >
                🚨 Signaler incident
              </Button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="button" variant="secondary" onClick={() => setShowTaskModal(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="primary" isLoading={createMutation.isPending || updateMutation.isPending}>
                {editingTask ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Incident Creation Modal triggered from task */}
      {showIncidentModal && (
        <CreateIncidentModal
          defaultTitle={incidentPrefill.title}
          defaultLocation={incidentPrefill.location}
          onClose={() => {
            setShowIncidentModal(false)
            setIncidentPrefill({})
          }}
        />
      )}
    </div>
  )
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onCreateIncident,
}: {
  task: any
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: any) => void
  onCreateIncident: () => void
}) {
  const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['MEDIUM']

  return (
    <div
      style={{
        background: 'var(--s4s-bg-card)',
        borderRadius: 'var(--s4s-radius-md)',
        border: '1px solid var(--s4s-border)',
        padding: '0.875rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        boxShadow: 'var(--s4s-shadow-sm)',
        transition: 'transform var(--s4s-transition-fast), box-shadow var(--s4s-transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 600, color: 'var(--s4s-text-primary)', cursor: 'pointer' }} onClick={onEdit}>
          {task.name}
        </h4>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: priorityInfo.color, whiteSpace: 'nowrap' }}>
          {priorityInfo.label}
        </span>
      </div>

      {task.description && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--s4s-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', color: 'var(--s4s-text-muted)' }}>
        <div>🕒 {formatDateTimeRange(task.startTime, task.endTime)}</div>
        {task.location && <div>📍 {task.location}</div>}
      </div>

      {task.assignments && task.assignments.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          {task.assignments.map((a: any) => (
            <span
              key={a.id}
              style={{
                fontSize: '0.72rem',
                background: 'var(--s4s-primary-light)',
                color: 'var(--s4s-primary-dark)',
                padding: '0.15rem 0.4rem',
                borderRadius: 'var(--s4s-radius-sm)',
                fontWeight: 500,
              }}
            >
              {a.staffMember.firstName}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--s4s-border)', marginTop: '0.25rem' }}>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value)}
          style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.4rem',
            borderRadius: 'var(--s4s-radius-sm)',
            border: '1px solid var(--s4s-border)',
            background: 'var(--s4s-bg-subtle)',
            color: 'var(--s4s-text-primary)',
            fontWeight: 500,
          }}
        >
          <option value="PENDING">À faire</option>
          <option value="IN_PROGRESS">En cours</option>
          <option value="DONE">Terminé</option>
          <option value="CANCELLED">Annulé</option>
        </select>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button type="button" onClick={onCreateIncident} title="Signaler un incident" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
            🚨
          </button>
          <button type="button" onClick={onEdit} title="Modifier" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
            ✏️
          </button>
          <button type="button" onClick={onDelete} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}
