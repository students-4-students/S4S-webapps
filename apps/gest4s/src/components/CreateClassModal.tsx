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
  defaultSection: string
  initialData?: any
  onClose: () => void
}

function CreateClassModal({ defaultSection, initialData, onClose }: Props) {
  const utils = trpc.useUtils()

  const [title, setTitle] = useState(initialData?.title || '')
  const [type, setType] = useState<'LECTURE' | 'EXERCISE' | 'SPECIAL' | 'MEAL'>(
    initialData?.type || 'LECTURE'
  )
  const [selectedSections, setSelectedSections] = useState<string[]>(() => {
    if (initialData?.sections && initialData.sections.length > 0) {
      return initialData.sections.map((s: any) => s.name.toUpperCase())
    }
    if (initialData?.section?.name) {
      return [initialData.section.name.toUpperCase()]
    }
    if (defaultSection && SECTIONS.includes(defaultSection.toUpperCase())) {
      return [defaultSection.toUpperCase()]
    }
    return ['CMS']
  })
  const [targetGroup, setTargetGroup] = useState<'ALL' | 'A' | 'B'>(
    initialData?.targetGroup || 'ALL'
  )

  const formatHHMM = (dStr: string | Date) => {
    const d = new Date(dStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatYYYYMMDD = (dStr: string | Date) => {
    const d = new Date(dStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const { data: dbRooms = [] } = trpc.rooms.list.useQuery()

  const [day, setDay] = useState(initialData?.startTime ? formatYYYYMMDD(initialData.startTime) : '2026-08-26')
  const [startTime, setStartTime] = useState(initialData?.startTime ? formatHHMM(initialData.startTime) : '08:00')
  const [endTime, setEndTime] = useState(initialData?.endTime ? formatHHMM(initialData.endTime) : '10:00')
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([])
  const [isRoomsInitialized, setIsRoomsInitialized] = useState(false)

  React.useEffect(() => {
    if (dbRooms.length > 0 && !isRoomsInitialized && initialData) {
      const loc = initialData.location || ''
      const locNames = loc.split(/[,;/]+/).map((s: string) => s.trim().toUpperCase()).filter(Boolean)

      let matched: string[] = []
      if (locNames.length > 0) {
        matched = dbRooms
          .filter((r: any) => {
            const rName = r.name.trim().toUpperCase()
            return locNames.includes(rName)
          })
          .map((r: any) => r.id)
      }

      if (matched.length === 0 && initialData.roomId) {
        matched = [initialData.roomId]
      }

      setSelectedRoomIds(matched)
      setIsRoomsInitialized(true)
    }
  }, [dbRooms, initialData, isRoomsInitialized])

  const [speakerId, setSpeakerId] = useState<string>(
    initialData?.speakerId || initialData?.speaker?.id || ''
  )
  const [assistantId, setAssistantId] = useState<string>(
    initialData?.assistantId || initialData?.assistant?.id || ''
  )
  const [rcId, setRcId] = useState<string>(initialData?.rcId || initialData?.rc?.id || '')

  const matchedRooms = dbRooms.filter((r: any) => selectedRoomIds.includes(r.id))
  const locationString = matchedRooms.length > 0 ? matchedRooms.map((r: any) => r.name).join(', ') : undefined

  const conflictQuery = trpc.schedules.checkConflicts.useQuery(
    {
      startTime: new Date(`${day}T${startTime}:00`),
      endTime: new Date(`${day}T${endTime}:00`),
      sectionIds: selectedSections,
      location: locationString,
    },
    {
      enabled: Boolean(day && startTime && endTime),
    }
  )
  const conflicts = conflictQuery.data || []

  const createMutation = trpc.schedules.create.useMutation()

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedSections.length === 0) {
      alert('Veuillez sélectionner au moins une section.')
      return
    }

    try {
      const startStr = `${day}T${startTime}:00`
      const endStr = `${day}T${endTime}:00`

      await createMutation.mutateAsync({
        title,
        type,
        startTime: new Date(startStr),
        endTime: new Date(endStr),
        location: locationString,
        roomId: selectedRoomIds[0] || undefined,
        sectionId: selectedSections[0] || undefined,
        sectionIds: selectedSections,
        targetGroup: targetGroup === 'ALL' ? undefined : targetGroup,
        speakerId: speakerId || undefined,
        assistantId: assistantId || undefined,
        rcId: rcId || undefined,
      })

      utils.schedules.list.invalidate()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Créer un cours" size="lg">
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

        {/* Multi-Select Rooms Component */}
        <div style={{ marginBottom: '1rem' }}>
          <MultiSelectCombobox
            label="Locaux / Salles (Sélection multiple)"
            placeholder="Rechercher et sélectionner des locaux (ex: BC 410, CO 1)..."
            options={dbRooms.map((r: any) => ({
              id: r.id,
              label: r.name,
              sublabel: r.building ? `Bâtiment ${r.building}` : undefined,
              category: r.building ? r.building.toUpperCase() : undefined,
            }))}
            selectedIds={selectedRoomIds}
            onChange={setSelectedRoomIds}
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
                  name="targetGroup"
                  value={grp.id}
                  checked={targetGroup === grp.id}
                  onChange={() => setTargetGroup(grp.id as any)}
                />
                {grp.label}
              </label>
            ))}
          </div>
        </div>

        {/* Single Session Date & Time */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label className="s4s-label">Horaire (Jour & Heures) *</label>
          <div
            style={{
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
              padding: '0.6rem 0.75rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 'var(--s4s-radius-md)',
              border: '1px solid rgba(238, 212, 241, 0.15)',
              marginTop: '0.35rem',
            }}
          >
            <select
              className="s4s-select"
              style={{ flex: 1.5, padding: '0.4rem' }}
              value={day}
              onChange={(e) => setDay(e.target.value)}
            >
              {DAYS.map((d) => (
                <option key={d.dateStr} value={d.dateStr}>
                  {d.label}
                </option>
              ))}
            </select>

            <input
              type="time"
              required
              className="s4s-input"
              style={{ flex: 1, padding: '0.4rem', minWidth: '85px' }}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />

            <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>à</span>

            <input
              type="time"
              required
              className="s4s-input"
              style={{ flex: 1, padding: '0.4rem', minWidth: '85px' }}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {createMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>{createMutation.error.message}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateClassModal
