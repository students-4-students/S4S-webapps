import { useState, useEffect, useMemo } from 'react'
import { trpc } from '../trpc'
import { Badge, LoadingSpinner, SearchInput, Select, Button } from '@s4s/ui'

function formatTimeOnly(dateStrOrObj: Date | string) {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

function normalizeRoomName(name: string) {
  return name.trim().toUpperCase()
}

function isLocationMatch(locationString: string | null | undefined, roomName: string) {
  if (!locationString) return false
  const target = normalizeRoomName(roomName)
  const tokens = locationString.split(/[,;/]+/).map(normalizeRoomName).filter(Boolean)
  if (tokens.includes(target)) return true
  if (tokens.some((tok) => tok === target || tok.includes(target) || target.includes(tok))) return true
  const fullLoc = normalizeRoomName(locationString)
  return fullLoc.includes(target) || target.includes(fullLoc)
}

export function AvailableRoomsCard() {
  const [now, setNow] = useState<Date>(() => new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('all')

  // Keep current time updated every 15 seconds so availability is real-time
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 15000)
    return () => clearInterval(timer)
  }, [])

  const { data: rooms = [], isLoading: loadingRooms } = trpc.rooms.list.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  })

  const { data: schedules = [], isLoading: loadingSchedules } = trpc.schedules.list.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  })

  const { data: workshops = [], isLoading: loadingWorkshops } = trpc.workshops.list.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  })

  const { data: tasks = [], isLoading: loadingTasks } = trpc.tasks.list.useQuery(undefined, {
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  })

  const isLoading = loadingRooms || loadingSchedules || loadingWorkshops || loadingTasks

  // Extract all unique buildings from the database rooms
  const allBuildings = useMemo(() => {
    const set = new Set<string>()
    rooms.forEach((r) => {
      if (r.building && r.building.trim()) {
        set.add(r.building.trim().toUpperCase())
      }
    })
    return Array.from(set).sort()
  }, [rooms])

  // Filter currently available rooms (accessible + no class/workshop/task)
  const availableRooms = useMemo(() => {
    const nowMs = now.getTime()

    return rooms
      .map((room) => {
        // 1. Check if room is currently accessible (has active availability slot in rooms page)
        const activeAvailSlot = (room.availabilities || []).find((slot: any) => {
          const startMs = new Date(slot.startTime).getTime()
          const endMs = new Date(slot.endTime).getTime()
          return nowMs >= startMs && nowMs <= endMs
        })

        if (!activeAvailSlot) {
          return null
        }

        // 2. Check if a class (ScheduleSlot) is taking place in this room right now
        const activeScheduleSlot = schedules.find((slot: any) => {
          const startMs = new Date(slot.startTime).getTime()
          const endMs = new Date(slot.endTime).getTime()
          const isCurrent = nowMs >= startMs && nowMs <= endMs
          if (!isCurrent) return false

          const isSameRoom = slot.roomId === room.id || isLocationMatch(slot.location, room.name)
          return isSameRoom
        })

        if (activeScheduleSlot) {
          return null
        }

        // 3. Check if a workshop session is taking place in this room right now
        const activeWorkshop = workshops.find((w: any) => {
          return (w.dates || []).some((session: any) => {
            const startMs = new Date(session.startTime).getTime()
            const endMs = new Date(session.endTime).getTime()
            const isCurrent = nowMs >= startMs && nowMs <= endMs
            if (!isCurrent) return false

            const sessionRoomMatch = session.roomId
              ? session.roomId === room.id
              : (session.location ? isLocationMatch(session.location, room.name) : (w.roomId === room.id || isLocationMatch(w.location, room.name)))

            return sessionRoomMatch
          })
        })

        if (activeWorkshop) {
          return null
        }

        // 4. Check if a task is taking place in this room right now
        const activeTask = tasks.find((t: any) => {
          const startMs = new Date(t.startTime).getTime()
          const endMs = new Date(t.endTime).getTime()
          const isCurrent = nowMs >= startMs && nowMs <= endMs
          if (!isCurrent) return false

          const isSameRoom = t.roomId === room.id || isLocationMatch(t.location, room.name)
          return isSameRoom
        })

        if (activeTask) {
          return null
        }

        // 5. Calculate until when this room remains free
        const currentSlotEndMs = new Date(activeAvailSlot.endTime).getTime()

        let nextEventStartMs = currentSlotEndMs
        let nextEventTitle: string | null = null

        schedules.forEach((slot: any) => {
          const isSameRoom = slot.roomId === room.id || isLocationMatch(slot.location, room.name)
          if (!isSameRoom) return
          const startMs = new Date(slot.startTime).getTime()
          if (startMs > nowMs && startMs < nextEventStartMs) {
            nextEventStartMs = startMs
            nextEventTitle = `Cours: ${slot.title}`
          }
        })

        workshops.forEach((w: any) => {
          ;(w.dates || []).forEach((session: any) => {
            const sessionRoomMatch = session.roomId
              ? session.roomId === room.id
              : (session.location ? isLocationMatch(session.location, room.name) : (w.roomId === room.id || isLocationMatch(w.location, room.name)))

            if (!sessionRoomMatch) return

            const startMs = new Date(session.startTime).getTime()
            if (startMs > nowMs && startMs < nextEventStartMs) {
              nextEventStartMs = startMs
              nextEventTitle = `Workshop: ${w.title}`
            }
          })
        })

        tasks.forEach((t: any) => {
          const isSameRoom = t.roomId === room.id || isLocationMatch(t.location, room.name)
          if (!isSameRoom) return
          const startMs = new Date(t.startTime).getTime()
          if (startMs > nowMs && startMs < nextEventStartMs) {
            nextEventStartMs = startMs
            nextEventTitle = `Tâche: ${t.name}`
          }
        })

        return {
          room,
          activeAvailSlot,
          availableUntil: new Date(nextEventStartMs),
          nextEventTitle,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
  }, [rooms, schedules, workshops, tasks, now])

  // Apply search query and building filter to available rooms
  const filteredAvailableRooms = useMemo(() => {
    return availableRooms.filter(({ room }) => {
      const roomBuilding = (room.building || '').toUpperCase()
      const matchesBuilding = selectedBuilding === 'all' || roomBuilding === selectedBuilding.toUpperCase()

      const query = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !query ||
        room.name.toLowerCase().includes(query) ||
        (room.building && room.building.toLowerCase().includes(query)) ||
        (room.description && room.description.toLowerCase().includes(query))

      return matchesBuilding && matchesSearch
    })
  }, [availableRooms, searchQuery, selectedBuilding])

  const hasFilterActive = searchQuery !== '' || selectedBuilding !== 'all'

  return (
    <div
      className="col"
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        background: 'white',
        borderRadius: '1rem',
        padding: '1.25rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid #edf2f7',
          paddingBottom: '0.75rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '1.15rem',
              fontWeight: 700,
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            Salles Disponibles Actuellement
          </h2>
          {!isLoading && (
            <Badge variant={availableRooms.length > 0 ? 'success' : 'neutral'} showDot={availableRooms.length > 0}>
              {availableRooms.length} libre{availableRooms.length > 1 ? 's' : ''} / {rooms.length} salles
            </Badge>
          )}
        </div>
      </div>

      {/* Search and Building Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <SearchInput
            placeholder="Rechercher une salle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        <div style={{ width: '200px' }}>
          <Select value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)}>
            <option value="all">Tous les bâtiments</option>
            {allBuildings.map((b) => (
              <option key={b} value={b}>
                Bâtiment {b}
              </option>
            ))}
          </Select>
        </div>

        {hasFilterActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setSelectedBuilding('all')
            }}
          >
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Content Area: Grid of Available Rooms */}
      {isLoading ? (
        <div style={{ padding: '2rem 0' }}>
          <LoadingSpinner label="Vérification des disponibilités des locaux..." />
        </div>
      ) : availableRooms.length === 0 ? (
        <div
          style={{
            padding: '2rem 1.5rem',
            background: 'var(--s4s-bg-subtle, #f8fafc)',
            borderRadius: '0.75rem',
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '2rem' }}>🚪🔒</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>
            Aucune salle disponible actuellement
          </div>
          <div style={{ fontSize: '0.84rem', color: '#94a3b8', maxWidth: '500px', lineHeight: 1.5 }}>
            Toutes les salles enregistrées sont soit hors plage horaire d'accessibilité, soit actuellement occupées par un cours ou un workshop.
          </div>
        </div>
      ) : filteredAvailableRooms.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            background: 'var(--s4s-bg-subtle, #f8fafc)',
            borderRadius: '0.75rem',
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <div style={{ fontSize: '1.5rem' }}>🔍</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#475569' }}>
            Aucune salle disponible pour cette recherche
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {availableRooms.length} salle(s) disponible(s) dans d'autres bâtiments.
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setSelectedBuilding('all')
            }}
            style={{ marginTop: '0.4rem' }}
          >
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gridAutoRows: 'max-content',
            gap: '0.85rem',
            paddingRight: '0.35rem',
          }}
        >
          {filteredAvailableRooms.map(({ room, availableUntil, nextEventTitle }) => {
            return (
              <div
                key={room.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  padding: '0.9rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                }}
              >
                {/* Room Name & Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>
                      {room.name}
                    </span>
                    {room.isComputerRoom && (
                      <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                        🖥️ Ordi
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#059669',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '4px',
                      padding: '0.15rem 0.45rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    🟢 Libre
                  </span>
                </div>

                {/* Building / Floor / Capacity details */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.6rem',
                    fontSize: '0.78rem',
                    color: '#64748b',
                  }}
                >
                  {room.building && (
                    <span>
                      📍 Bât. <strong>{room.building}</strong>
                    </span>
                  )}
                  {room.floor !== null && room.floor !== undefined && (
                    <span>
                      Étage <strong>{room.floor}</strong>
                    </span>
                  )}
                  {room.capacity && (
                    <span>
                      👥 <strong>{room.capacity}</strong> p.
                    </span>
                  )}
                </div>

                {/* Availability time info */}
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: '#334155',
                    marginTop: '0.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    borderTop: '1px dashed #e2e8f0',
                    paddingTop: '0.45rem',
                  }}
                >
                  <span>🕒</span>
                  <span>
                    Disponible jusqu'à <strong>{formatTimeOnly(availableUntil)}</strong>
                    {nextEventTitle ? ` (${nextEventTitle})` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AvailableRoomsCard
