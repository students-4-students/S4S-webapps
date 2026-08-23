import { useState, useMemo } from 'react'
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
  toLocalDatetimeString,
  toISOStringFromLocal,
} from '@s4s/ui'

function formatTimeOnly(dateStrOrObj: Date | string) {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj
  return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

function formatDateOnly(dateStrOrObj: Date | string) {
  const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj
  return d.toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function Rooms() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState('all')
  const [computerFilter, setComputerFilter] = useState<'all' | 'computer' | 'standard'>('all')

  // Modals state
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<any | null>(null)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [slotRoom, setSlotRoom] = useState<any | null>(null)
  const [editingSlot, setEditingSlot] = useState<any | null>(null)

  // Room Form State
  const [name, setName] = useState('')
  const [building, setBuilding] = useState('')
  const [floor, setFloor] = useState<number | ''>(0)
  const [capacity, setCapacity] = useState<number | ''>('')
  const [isComputerRoom, setIsComputerRoom] = useState(false)
  const [description, setDescription] = useState('')
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')

  // Availability Slot Form State
  const [slotStartTime, setSlotStartTime] = useState('')
  const [slotEndTime, setSlotEndTime] = useState('')

  const utils = trpc.useUtils()

  // Queries
  const { data: rooms = [], isLoading: loadingRooms } = trpc.rooms.list.useQuery()

  // Mutations
  const createRoomMutation = trpc.rooms.create.useMutation()
  const updateRoomMutation = trpc.rooms.update.useMutation()
  const deleteRoomMutation = trpc.rooms.delete.useMutation()

  const addSlotMutation = trpc.rooms.addAvailability.useMutation()
  const updateSlotMutation = trpc.rooms.updateAvailability.useMutation()
  const deleteSlotMutation = trpc.rooms.deleteAvailability.useMutation()

  // Room modal handlers
  const openCreateRoomModal = () => {
    setEditingRoom(null)
    setName('')
    setBuilding('')
    setFloor(0)
    setCapacity('')
    setIsComputerRoom(false)
    setDescription('')
    setLatitude('')
    setLongitude('')
    setShowRoomModal(true)
  }

  const openEditRoomModal = (room: any) => {
    setEditingRoom(room)
    setName(room.name)
    setBuilding(room.building || '')
    setFloor(room.floor ?? 0)
    setCapacity(room.capacity ?? '')
    setIsComputerRoom(Boolean(room.isComputerRoom))
    setDescription(room.description || '')
    setLatitude(room.latitude ?? '')
    setLongitude(room.longitude ?? '')
    setShowRoomModal(true)
  }

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('Veuillez entrer un nom de local (ex: BC 410).')
      return
    }

    try {
      const payload = {
        name: name.trim(),
        building: building.trim() || undefined,
        floor: floor !== '' ? Number(floor) : 0,
        capacity: capacity !== '' ? Number(capacity) : undefined,
        isComputerRoom,
        description: description.trim() || undefined,
        latitude: latitude !== '' ? Number(latitude) : undefined,
        longitude: longitude !== '' ? Number(longitude) : undefined,
      }

      if (editingRoom) {
        await updateRoomMutation.mutateAsync({
          id: editingRoom.id,
          ...payload,
        })
      } else {
        await createRoomMutation.mutateAsync(payload)
      }

      utils.rooms.list.invalidate()
      setShowRoomModal(false)
    } catch (err: any) {
      alert('Erreur: ' + (err.message || err))
    }
  }

  const handleDeleteRoom = async (room: any) => {
    if (window.confirm(`Supprimer le local "${room.name}" et tous ses créneaux d'accès ?`)) {
      try {
        await deleteRoomMutation.mutateAsync({ id: room.id })
        utils.rooms.list.invalidate()
      } catch (err: any) {
        alert('Erreur lors de la suppression: ' + (err.message || err))
      }
    }
  }

  // Slot modal handlers
  const openAddSlotModal = (room: any) => {
    setSlotRoom(room)
    setEditingSlot(null)

    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0)
    const defaultEnd = new Date(now.getFullYear(), 2, 9, 23, 59)

    setSlotStartTime(toLocalDatetimeString(defaultStart))
    setSlotEndTime(toLocalDatetimeString(defaultEnd))
    setShowSlotModal(true)
  }

  const openEditSlotModal = (room: any, slot: any) => {
    setSlotRoom(room)
    setEditingSlot(slot)

    setSlotStartTime(toLocalDatetimeString(slot.startTime))
    setSlotEndTime(toLocalDatetimeString(slot.endTime))
    setShowSlotModal(true)
  }

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!slotStartTime || !slotEndTime) {
      alert('Veuillez renseigner les heures de début et de fin d\'accès.')
      return
    }

    try {
      const startIso = toISOStringFromLocal(slotStartTime)
      const endIso = toISOStringFromLocal(slotEndTime)

      const payload = {
        date: startIso,
        startTime: startIso,
        endTime: endIso,
      }

      if (editingSlot) {
        await updateSlotMutation.mutateAsync({
          id: editingSlot.id,
          ...payload,
        })
      } else {
        await addSlotMutation.mutateAsync({
          roomId: slotRoom.id,
          ...payload,
        })
      }

      utils.rooms.list.invalidate()
      setShowSlotModal(false)
    } catch (err: any) {
      alert('Erreur: ' + (err.message || err))
    }
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (window.confirm('Supprimer ce créneau d’accès ?')) {
      try {
        await deleteSlotMutation.mutateAsync({ id: slotId })
        utils.rooms.list.invalidate()
      } catch (err: any) {
        alert('Erreur: ' + (err.message || err))
      }
    }
  }

  // Unique list of buildings for filter dropdown
  const buildings = useMemo(() => {
    const set = new Set<string>()
    rooms.forEach((r) => {
      if (r.building) set.add(r.building)
    })
    return Array.from(set).sort()
  }, [rooms])

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.building && r.building.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.description && r.description.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesBuilding = selectedBuilding === 'all' || r.building === selectedBuilding

      let matchesComputer = true
      if (computerFilter === 'computer') {
        matchesComputer = Boolean(r.isComputerRoom)
      } else if (computerFilter === 'standard') {
        matchesComputer = !r.isComputerRoom
      }

      return matchesSearch && matchesBuilding && matchesComputer
    })
  }, [rooms, searchQuery, selectedBuilding, computerFilter])

  const bulkImportMutation = trpc.rooms.bulkImport.useMutation()

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        if (lines.length < 2) {
          alert('Le fichier CSV doit contenir au moins une ligne d’en-tête et une ligne de données.')
          return
        }

        const firstLine = lines[0]
        const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

        const splitRow = (row: string): string[] => {
          const result: string[] = []
          let current = ''
          let inQuotes = false

          for (let i = 0; i < row.length; i++) {
            const char = row[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result.map((cell) => cell.replace(/^["']|["']$/g, '').trim())
        }

        const rawHeaders = splitRow(firstLine)
        const headers = rawHeaders.map((h) => h.toLowerCase())

        const getIndex = (names: string[]): number => {
          return headers.findIndex((h) => names.some((n) => h.includes(n)))
        }

        const buildingIdx = getIndex(['bâtiment', 'batiment', 'building', 'bat', 'bât'])
        const nameIdx = getIndex(['nom', 'salle', 'local', 'name', 'room'])
        const floorIdx = getIndex(['étage', 'etage', 'floor'])
        const computerIdx = getIndex(['informatique', 'computer', 'pc', 'ordi', 'ordinateur'])
        const lngIdx = getIndex(['longitude', 'long', 'lng', 'lon'])
        const latIdx = getIndex(['latitude', 'lat'])

        if (nameIdx === -1) {
          alert("Le fichier CSV doit contenir au moins la colonne 'Nom' (ou Salle / Local).")
          return
        }

        const parsedRooms: any[] = []

        for (let i = 1; i < lines.length; i++) {
          const row = splitRow(lines[i])
          if (row.length === 0) continue

          const nameVal = row[nameIdx]
          if (!nameVal) continue

          const buildingVal = buildingIdx !== -1 ? row[buildingIdx] : undefined
          const floorVal = floorIdx !== -1 && row[floorIdx] !== '' ? parseInt(row[floorIdx], 10) : 0

          let isComputerVal = false
          if (computerIdx !== -1 && row[computerIdx]) {
            const cleanComp = row[computerIdx].toLowerCase()
            isComputerVal = ['1', 'true', 'oui', 'yes', 'vrai', 'x'].includes(cleanComp)
          }

          const parseCoord = (strVal?: string) => {
            if (!strVal) return undefined
            const clean = strVal.replace(',', '.')
            const num = parseFloat(clean)
            return isNaN(num) ? undefined : num
          }

          const lngVal = lngIdx !== -1 ? parseCoord(row[lngIdx]) : undefined
          const latVal = latIdx !== -1 ? parseCoord(row[latIdx]) : undefined

          parsedRooms.push({
            name: nameVal,
            building: buildingVal || undefined,
            floor: isNaN(floorVal) ? 0 : floorVal,
            isComputerRoom: isComputerVal,
            longitude: lngVal,
            latitude: latVal,
          })
        }

        if (parsedRooms.length === 0) {
          alert('Aucun local valide trouvé dans le fichier CSV.')
          return
        }

        const res = await bulkImportMutation.mutateAsync({ rooms: parsedRooms })
        alert(`Importation réussie ! ${res.createdCount} local(aux) créé(s), ${res.updatedCount} mis à jour (total: ${res.total}).`)
        utils.rooms.list.invalidate()
      } catch (err: any) {
        alert('Erreur lors de l’importation du CSV: ' + (err.message || err))
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const bulkImportAvailabilitiesMutation = trpc.rooms.bulkImportAvailabilities.useMutation()

  // Export Plages d'accessibilité to CSV
  const handleExportAvailabilitiesCSV = () => {
    const allSlots: { roomName: string; startTime: string; endTime: string }[] = []

    rooms.forEach((r) => {
      if (r.availabilities && r.availabilities.length > 0) {
        r.availabilities.forEach((a: any) => {
          allSlots.push({
            roomName: r.name,
            startTime: new Date(a.startTime).toISOString(),
            endTime: new Date(a.endTime).toISOString(),
          })
        })
      }
    })

    if (allSlots.length === 0) {
      alert('Aucune plage d’accessibilité à exporter.')
      return
    }

    const headers = ['Local', 'HeureDébut', 'HeureFin']
    const rows = allSlots.map((s) => [s.roomName, s.startTime, s.endTime])
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `plages_accessibilite_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Import Plages d'accessibilité from CSV
  const handleImportAvailabilitiesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (!text) return

      try {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        if (lines.length < 2) {
          alert('Le fichier CSV doit contenir au moins une ligne d’en-tête et une ligne de données.')
          return
        }

        const firstLine = lines[0]
        const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ','

        const splitRow = (row: string): string[] => {
          const result: string[] = []
          let current = ''
          let inQuotes = false

          for (let i = 0; i < row.length; i++) {
            const char = row[i]
            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === delimiter && !inQuotes) {
              result.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result.map((cell) => cell.replace(/^["']|["']$/g, '').trim())
        }

        const rawHeaders = splitRow(firstLine)
        const headers = rawHeaders.map((h) => h.toLowerCase())

        const getIndex = (names: string[]): number => {
          return headers.findIndex((h) => names.some((n) => h.includes(n)))
        }

        const roomIdx = getIndex(['local', 'salle', 'nom', 'room', 'roomname'])
        const startIdx = getIndex(['début', 'debut', 'start', 'starttime', 'heuredébut', 'heuredebut'])
        const endIdx = getIndex(['fin', 'end', 'endtime', 'heurefin'])

        if (roomIdx === -1 || startIdx === -1 || endIdx === -1) {
          alert("Le fichier CSV doit contenir les colonnes 'Local' (ou Salle), 'HeureDébut' et 'HeureFin'.")
          return
        }

        const parsedSlots: any[] = []

        for (let i = 1; i < lines.length; i++) {
          const row = splitRow(lines[i])
          if (row.length === 0) continue

          const rName = row[roomIdx]
          const startVal = row[startIdx]
          const endVal = row[endIdx]

          if (!rName || !startVal || !endVal) continue

          parsedSlots.push({
            roomName: rName,
            startTime: startVal,
            endTime: endVal,
          })
        }

        if (parsedSlots.length === 0) {
          alert('Aucune plage valide trouvée dans le fichier CSV.')
          return
        }

        const res = await bulkImportAvailabilitiesMutation.mutateAsync({ slots: parsedSlots })
        alert(`Importation réussie ! ${res.createdCount} plage(s) d'accès créée(s) (total: ${res.total}).`)
        utils.rooms.list.invalidate()
      } catch (err: any) {
        alert('Erreur lors de l’importation des plages: ' + (err.message || err))
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div className="rooms-page" style={{ padding: '1.5rem', width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
      {/* Header */}
      <PageHeader
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={openCreateRoomModal}>
              + Ajouter un local
            </Button>

            {/* Room CSV Import */}
            <label style={{ margin: 0 }}>
              <span className="s4s-button s4s-button--secondary s4s-button--md" style={{ cursor: 'pointer' }}>
                📥 Import Locaux CSV
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                style={{ display: 'none' }}
              />
            </label>

            {/* Availabilities Import & Export */}
            <label style={{ margin: 0 }}>
              <span className="s4s-button s4s-button--secondary s4s-button--md" style={{ cursor: 'pointer' }}>
                📥 Import Plages CSV
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportAvailabilitiesCSV}
                style={{ display: 'none' }}
              />
            </label>

            <Button variant="secondary" onClick={handleExportAvailabilitiesCSV}>
              📤 Export Plages CSV
            </Button>
          </div>
        }
      />


      {/* Filter controls */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <SearchInput
            placeholder="Rechercher par nom de salle (ex: BC 410), bâtiment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
          />
        </div>

        <div style={{ width: '180px' }}>
          <Select value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)}>
            <option value="all">Tous les bâtiments</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                Bâtiment {b}
              </option>
            ))}
          </Select>
        </div>

        <div style={{ width: '200px' }}>
          <Select value={computerFilter} onChange={(e) => setComputerFilter(e.target.value as any)}>
            <option value="all">Tous types de salles</option>
            <option value="computer">🖥️ Salles informatiques</option>
            <option value="standard">Salles standards</option>
          </Select>
        </div>

        {(searchQuery || selectedBuilding !== 'all' || computerFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('')
              setSelectedBuilding('all')
              setComputerFilter('all')
            }}
          >
            Effacer les filtres
          </Button>
        )}
      </div>

      {/* Content */}
      {loadingRooms ? (
        <LoadingSpinner label="Chargement de la gestion des locaux..." />
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          icon="🚪"
          title="Aucune salle enregistrée"
          description="Créez votre première salle pour gérer ses plages horaires d'accessibilité."
          actionLabel="+ Créer une salle"
          onAction={openCreateRoomModal}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem', alignItems: 'stretch' }}>
          {filteredRooms.map((room) => {
            const now = new Date()
            const isCurrentlyAccessible = room.availabilities?.some((slot: any) => {
              const start = new Date(slot.startTime)
              const end = new Date(slot.endTime)
              return now >= start && now <= end
            })

            return (
              <div
                key={room.id}
                style={{
                  background: 'var(--s4s-bg-card)',
                  borderRadius: 'var(--s4s-radius-lg)',
                  border: '1px solid var(--s4s-border)',
                  boxShadow: 'var(--s4s-shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '1.25rem',
                  gap: '0.85rem',
                }}
              >
                {/* Card Title Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--s4s-text-primary)' }}>
                        {room.name}
                      </h3>
                      {room.isComputerRoom && (
                        <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                          🖥️ Salle info
                        </span>
                      )}
                      {isCurrentlyAccessible ? (
                        <Badge variant="success" showDot>Accessible actuellement</Badge>
                      ) : (
                        <Badge variant="warning">Non accessible actuellement</Badge>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--s4s-text-muted)', marginTop: '0.25rem', display: 'flex', gap: '0.75rem' }}>
                      {room.building && <span>📍 Bâtiment: <strong>{room.building}</strong></span>}
                      {room.floor !== null && room.floor !== undefined && <span>Étage: <strong>{room.floor}</strong></span>}
                      {room.capacity && <span>👥 Capacité: <strong>{room.capacity} p.</strong></span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <Button variant="ghost" size="sm" onClick={() => openEditRoomModal(room)} title="Modifier le local">
                      ✏️
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteRoom(room)} title="Supprimer le local">
                      🗑️
                    </Button>
                  </div>
                </div>

                {room.description && (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--s4s-text-secondary)', lineHeight: '1.4' }}>
                    {room.description}
                  </p>
                )}

                {/* Accessible time slots list */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed var(--s4s-border)', paddingTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--s4s-text-primary)' }}>
                      🕒 Plages d'accessibilité ({room.availabilities?.length || 0})
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => openAddSlotModal(room)}>
                      + Ajouter plage
                    </Button>
                  </div>

                  {!room.availabilities || room.availabilities.length === 0 ? (
                    <div style={{ padding: '0.75rem', background: 'var(--s4s-bg-subtle)', borderRadius: 'var(--s4s-radius-md)', fontSize: '0.78rem', color: 'var(--s4s-text-muted)', textAlign: 'center' }}>
                      Aucun créneau horaire configuré
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {room.availabilities.map((slot: any) => {
                        const start = new Date(slot.startTime)
                        const end = new Date(slot.endTime)
                        const isLive = now >= start && now <= end

                        return (
                          <div
                            key={slot.id}
                            style={{
                              padding: '0.5rem 0.65rem',
                              background: isLive ? '#ecfdf5' : 'var(--s4s-bg-subtle)',
                              border: isLive ? '1px solid #10b981' : '1px solid var(--s4s-border)',
                              borderRadius: 'var(--s4s-radius-md)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div style={{ fontWeight: 600, color: isLive ? '#065f46' : 'var(--s4s-text-primary)' }}>
                              ⏰ {formatDateOnly(slot.startTime)} : {formatTimeOnly(slot.startTime)} - {formatTimeOnly(slot.endTime)}
                            </div>

                            <div style={{ display: 'flex', gap: '0.2rem' }}>
                              <Button variant="ghost" size="sm" onClick={() => openEditSlotModal(room, slot)} title="Modifier ce créneau">
                                ✏️
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteSlot(slot.id)} title="Supprimer ce créneau">
                                🗑️
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Room Modal */}
      <Modal
        isOpen={showRoomModal}
        onClose={() => setShowRoomModal(false)}
        title={editingRoom ? 'Modifier le local' : 'Ajouter un local'}
        size="md"
      >
        <form onSubmit={handleRoomSubmit}>
          <Input
            label="Nom du local"
            required
            placeholder="Ex: BC 410, CO 1, Hall SG"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Bâtiment"
                placeholder="Ex: BC, CO, INF"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Étage (Map)"
                type="number"
                placeholder="Ex: 0, 1, 2, -1"
                value={floor}
                onChange={(e) => setFloor(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Capacité (pers.)"
                type="number"
                placeholder="Ex: 120"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ margin: '0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem', background: isComputerRoom ? '#e0e7ff' : 'var(--s4s-bg-subtle)', border: isComputerRoom ? '1px solid #c7d2fe' : '1px solid var(--s4s-border)', borderRadius: 'var(--s4s-radius-md)', transition: 'all 120ms ease' }}>
            <input
              type="checkbox"
              id="isComputerRoomCheckbox"
              checked={isComputerRoom}
              onChange={(e) => setIsComputerRoom(e.target.checked)}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />
            <label htmlFor="isComputerRoomCheckbox" style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem', color: isComputerRoom ? '#3730a3' : 'var(--s4s-text-primary)', userSelect: 'none' }}>
              🖥️ Salle informatique (équipée d'ordinateurs fixes)
            </label>
          </div>

          <div className="s4s-form-field">
            <label className="s4s-label">Description / Remarques</label>
            <textarea
              className="s4s-input"
              rows={3}
              placeholder="Ex: Projecteur HD, 120 places assises, clé auprès du PC Securité"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Latitude GPS (optionnel)"
                type="number"
                step="any"
                placeholder="Ex: 46.5185"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Longitude GPS (optionnel)"
                type="number"
                step="any"
                placeholder="Ex: 6.5666"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setShowRoomModal(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" isLoading={createRoomMutation.isPending || updateRoomMutation.isPending}>
              {editingRoom ? 'Enregistrer les modifications' : 'Créer le local'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessibility Slot Modal */}
      <Modal
        isOpen={showSlotModal}
        onClose={() => setShowSlotModal(false)}
        title={editingSlot ? `Modifier plage d'accès pour ${slotRoom?.name}` : `Ajouter plage d'accès pour ${slotRoom?.name}`}
        size="md"
      >
        <form onSubmit={handleSlotSubmit}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Heure de début d'accès *"
                type="datetime-local"
                required
                value={slotStartTime}
                onChange={(e) => setSlotStartTime(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Heure de fin d'accès *"
                type="datetime-local"
                required
                value={slotEndTime}
                onChange={(e) => setSlotEndTime(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="ghost" type="button" onClick={() => setShowSlotModal(false)}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" isLoading={addSlotMutation.isPending || updateSlotMutation.isPending}>
              {editingSlot ? 'Modifier la plage' : 'Ajouter la plage'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
