import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Select, Button, MultiSelectCombobox } from '@s4s/ui'
import StaffCombobox from './StaffCombobox'

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
  'CMS', 'POLYSI', 'AR', 'CH', 'EL', 'GC', 'IN', 'MA', 'GM', 'MT', 'MX', 'PH', 'SC', 'SIE', 'SV'
]

interface Props {
  slot: any
  onClose: () => void
  onDuplicate?: (slot: any) => void
}

function EditClassModal({ slot, onClose, onDuplicate }: Props) {
  const utils = trpc.useUtils()

  const startObj = new Date(slot.startTime)
  const endObj = new Date(slot.endTime)

  const formatYYYYMMDD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatHHMM = (d: Date) => {
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const { data: dbRooms = [] } = trpc.rooms.list.useQuery()

  const [title, setTitle] = useState(slot.title)
  const [type, setType] = useState<'LECTURE' | 'EXERCISE' | 'SPECIAL' | 'MEAL'>(
    slot.type === 'EXERCISE' ? 'EXERCISE' : (slot.type === 'SPECIAL' ? 'SPECIAL' : (slot.type === 'MEAL' ? 'MEAL' : 'LECTURE'))
  )
  const [day, setDay] = useState(formatYYYYMMDD(startObj))
  const [startTime, setStartTime] = useState(formatHHMM(startObj))
  const [endTime, setEndTime] = useState(formatHHMM(endObj))

  const [location, setLocation] = useState(slot.location || '')
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [isRoomsInitialized, setIsRoomsInitialized] = useState(false)

  React.useEffect(() => {
    if (dbRooms.length > 0 && !isRoomsInitialized) {
      const loc = slot.location || ''
      const locNames = loc.split(/[,;/]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean)

      let matched: string[] = []
      if (locNames.length > 0) {
        matched = dbRooms
          .filter((r: any) => {
            const rName = r.name.trim().toUpperCase()
            return locNames.includes(rName) || locNames.some((l: string) => l === rName || l.includes(rName) || rName.includes(l))
          })
          .map((r: any) => r.id)
      }

      if (matched.length === 0 && slot.roomId) {
        matched = [slot.roomId]
      }

      setSelectedRoomIds(matched)
      setIsRoomsInitialized(true)
    }
  }, [dbRooms, slot.location, slot.roomId, isRoomsInitialized])

  const [selectedSections, setSelectedSections] = useState<string[]>(() => {
    if (slot.sections && slot.sections.length > 0) {
      return slot.sections.map((s: any) => s.name.toUpperCase())
    }
    if (slot.section?.name) {
      return [slot.section.name.toUpperCase()]
    }
    return ['CMS']
  })
  const [targetGroup, setTargetGroup] = useState<'ALL' | 'A' | 'B'>(
    slot.targetGroup || 'ALL'
  )
  const [speakerId, setSpeakerId] = useState<string>(slot.speakerId || slot.speaker?.id || '')
  const [assistantId, setAssistantId] = useState<string>(slot.assistantId || slot.assistant?.id || '')
  const [rcId, setRcId] = useState<string>(slot.rcId || slot.rc?.id || '')

  const conflictQuery = trpc.schedules.checkConflicts.useQuery(
    {
      id: slot.id,
      startTime: new Date(`${day}T${startTime}:00`),
      endTime: new Date(`${day}T${endTime}:00`),
      location: location || undefined,
      sectionIds: selectedSections,
    },
    {
      enabled: Boolean(day && startTime && endTime),
    }
  )
  const conflicts = conflictQuery.data || []

  const toggleSection = (sec: string) => {
    if (selectedSections.includes(sec)) {
      setSelectedSections(selectedSections.filter((s) => s !== sec))
    } else {
      setSelectedSections([...selectedSections, sec])
    }
  }

  const selectAllExceptPolysi = () => {
    setSelectedSections(SECTIONS.filter((s) => s !== 'POLYSI'))
  }

  const selectBA1 = () => {
    const excluded = ['POLYSI', 'MA', 'PH', 'CMS', 'AR']
    setSelectedSections(SECTIONS.filter((s) => !excluded.includes(s)))
  }

  const selectPhMa = () => {
    setSelectedSections(['PH', 'MA'])
  }

  const updateMutation = trpc.schedules.update.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate()
      onClose()
    },
  })

  const deleteMutation = trpc.schedules.delete.useMutation({
    onSuccess: () => {
      utils.schedules.list.invalidate()
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedSections.length === 0) {
      alert('Veuillez sélectionner au moins une section.')
      return
    }

    const startStr = `${day}T${startTime}:00`
    const endStr = `${day}T${endTime}:00`
    const matchedRooms = dbRooms.filter((r: any) => selectedRoomIds.includes(r.id))
    const locationStr = matchedRooms.length > 0 ? matchedRooms.map((r: any) => r.name).join(', ') : (location || null)

    updateMutation.mutate({
      id: slot.id,
      title,
      type,
      startTime: new Date(startStr),
      endTime: new Date(endStr),
      location: locationStr,
      roomId: selectedRoomIds[0] || null,
      sectionId: selectedSections[0] || null,
      sectionIds: selectedSections,
      targetGroup: targetGroup === 'ALL' ? null : targetGroup,
      speakerId: speakerId || null,
      assistantId: assistantId || null,
      rcId: rcId || null,
    })
  }

  function handleDelete() {
    if (confirm('Voulez-vous vraiment supprimer ce cours ?')) {
      deleteMutation.mutate({ id: slot.id })
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Modifier le cours" size="lg">
      <form onSubmit={handleSubmit}>
        {conflicts.length > 0 && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--s4s-danger)',
              borderRadius: 'var(--s4s-radius-md)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚠️ Conflit(s) de réservation ({conflicts.length})</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {conflicts.map((c: any, idx: number) => (
                <li key={idx}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}

        <Input
          label="Titre"
          required
          placeholder="Ex: Analyse I, Physique générale"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <Select
          label="Type de cours"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
        >
          <option value="LECTURE">Cours (Lecture)</option>
          <option value="EXERCISE">Exercices (Exercise)</option>
          <option value="SPECIAL">Spécial (Special)</option>
          <option value="MEAL">Repas (Meal)</option>
        </Select>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <StaffCombobox
            label="Speaker"
            value={speakerId}
            onChange={setSpeakerId}
            placeholder="Rechercher speaker..."
            defaultCategory="Speaker"
          />

          <StaffCombobox
            label="Assistant"
            value={assistantId}
            onChange={setAssistantId}
            placeholder="Rechercher assistant..."
            defaultCategory="Assistant"
          />

          <StaffCombobox
            label="RC (Responsable)"
            value={rcId}
            onChange={setRcId}
            placeholder="Rechercher RC..."
            defaultCategory="RC"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <MultiSelectCombobox
            label="Locaux / Salles"
            placeholder="Rechercher des locaux (ex: BC 410, CO 1)..."
            options={dbRooms.map((r: any) => ({
              id: r.id,
              label: r.name,
              sublabel: r.building ? `Bâtiment ${r.building}` : undefined,
              category: r.building ? r.building.toUpperCase() : undefined,
            }))}
            selectedIds={selectedRoomIds}
            onChange={(nextIds) => {
              const matchedNames = dbRooms
                .filter((r: any) => nextIds.includes(r.id))
                .map((r: any) => r.name)
              setSelectedRoomIds(nextIds)
              setLocation(matchedNames.join(', '))
            }}
            categories={Array.from(
              new Set(dbRooms.map((r: any) => r.building?.toUpperCase()).filter(Boolean) as string[])
            )}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <label className="s4s-label">Sections * (Sélectionnez au moins une)</label>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <Button type="button" variant="outline" size="sm" onClick={selectAllExceptPolysi} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                Toutes (sans POLYSI)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectBA1} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                BA1
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={selectPhMa} style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                PH-MA
              </Button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.375rem' }}>
            {SECTIONS.map((sec) => {
              const isSelected = selectedSections.includes(sec)
              return (
                <button
                  key={sec}
                  type="button"
                  onClick={() => toggleSection(sec)}
                  style={{
                    padding: '0.4rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 'var(--s4s-radius-sm)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--s4s-primary)' : 'rgba(255, 255, 255, 0.2)',
                    background: isSelected ? 'var(--s4s-primary)' : 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all var(--s4s-transition-fast)',
                    textAlign: 'center'
                  }}
                >
                  {sec}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label className="s4s-label">Groupe concerné (Optionnel)</label>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem' }}>
            {[
              { id: 'ALL', label: 'Tous' },
              { id: 'A', label: 'Groupe A' },
              { id: 'B', label: 'Groupe B' },
            ].map((grp) => (
              <label key={grp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem', color: '#ffffff' }}>
                <input
                  type="radio"
                  name="editTargetGroup"
                  value={grp.id}
                  checked={targetGroup === grp.id}
                  onChange={() => setTargetGroup(grp.id as any)}
                />
                {grp.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ flex: 2 }}>
            <Select label="Jour" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.dateStr} value={d.dateStr}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Début"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Fin"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {updateMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>{updateMutation.error.message}</p>
        )}
        {deleteMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>{deleteMutation.error.message}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
            >
              Supprimer
            </Button>
            {onDuplicate && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onDuplicate({
                    title,
                    type,
                    section: { name: selectedSections[0] },
                    sections: selectedSections.map((name) => ({ name })),
                    startTime: `${day}T${startTime}:00`,
                    endTime: `${day}T${endTime}:00`,
                    location,
                    roomId: selectedRoomIds[0] || null,
                    speakerId,
                    assistantId,
                    rcId,
                  })
                }}
              >
                📋 Dupliquer
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={updateMutation.isPending}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default EditClassModal
