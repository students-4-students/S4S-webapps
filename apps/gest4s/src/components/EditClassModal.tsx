import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Select, Button } from '@s4s/ui'

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
  'CMS', 'POLYSI', 'AR', 'CH', 'EL', 'GC', 'IN', 'MA', 'ME', 'MT', 'MX', 'PH', 'SC', 'SIE', 'SV'
]

interface Props {
  slot: any
  onClose: () => void
}

function EditClassModal({ slot, onClose }: Props) {
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

  const [title, setTitle] = useState(slot.title)
  const [type, setType] = useState<'LECTURE' | 'EXERCISE' | 'SPECIAL' | 'MEAL'>(
    slot.type === 'EXERCISE' ? 'EXERCISE' : (slot.type === 'SPECIAL' ? 'SPECIAL' : (slot.type === 'MEAL' ? 'MEAL' : 'LECTURE'))
  )
  const [day, setDay] = useState(formatYYYYMMDD(startObj))
  const [startTime, setStartTime] = useState(formatHHMM(startObj))
  const [endTime, setEndTime] = useState(formatHHMM(endObj))
  const [location, setLocation] = useState(slot.location || '')
  const [sectionId, setSectionId] = useState(slot.section?.name || 'CMS')

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

    const startStr = `${day}T${startTime}:00`
    const endStr = `${day}T${endTime}:00`

    updateMutation.mutate({
      id: slot.id,
      title,
      type,
      startTime: new Date(startStr),
      endTime: new Date(endStr),
      location: location || null,
      sectionId,
    })
  }

  function handleDelete() {
    if (confirm('Voulez-vous vraiment supprimer ce cours ?')) {
      deleteMutation.mutate({ id: slot.id })
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Modifier le cours" size="md">
      <form onSubmit={handleSubmit}>
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

        <Input
          label="Salle / Lieu"
          placeholder="Ex: CO2, INM202"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <Select
          label="Section"
          value={sectionId}
          onChange={(e) => setSectionId(e.target.value)}
        >
          {SECTIONS.map((sec) => (
            <option key={sec} value={sec}>
              {sec}
            </option>
          ))}
        </Select>

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
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteMutation.isPending}
          >
            Supprimer
          </Button>

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
