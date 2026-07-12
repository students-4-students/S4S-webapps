import React, { useState } from 'react'
import { trpc } from '../trpc'

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

  // Format existing Dates
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

  // Form States
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
    <div className='modal-overlay' onClick={onClose}>
      <div className='modal' style={{ width: '420px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>Modifier le cours</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Titre *
            <input
              required
              placeholder="Ex: Analyse I, Physique générale"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label>
            Type de cours *
            <select value={type} onChange={(e) => setType(e.target.value as any)}>
              <option value='LECTURE'>Cours (Lecture)</option>
              <option value='EXERCISE'>Exercices (Exercise)</option>
              <option value='SPECIAL'>Spécial (Special)</option>
              <option value='MEAL'>Repas (Meal)</option>
            </select>
          </label>

          <label>
            Salle / Lieu
            <input
              placeholder="Ex: CO2, INM202"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>

          <label>
            Section *
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 2 }}>
              Jour *
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                {DAYS.map((d) => (
                  <option key={d.dateStr} value={d.dateStr}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Début *
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </label>
            <label style={{ flex: 1 }}>
              Fin *
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </label>
          </div>

          <div className='modal-actions' style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button
              type='button'
              onClick={handleDelete}
              style={{
                background: '#e74c3c',
                color: 'white',
                marginTop: 0,
              }}
              disabled={deleteMutation.isPending || updateMutation.isPending}
            >
              {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
            </button>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type='button' onClick={onClose} style={{ marginTop: 0 }}>Annuler</button>
              <button
                type='submit'
                className='btn-primary'
                style={{ marginTop: 0 }}
                disabled={deleteMutation.isPending || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
          
          {updateMutation.isError && <p className='error'>{updateMutation.error.message}</p>}
          {deleteMutation.isError && <p className='error'>{deleteMutation.error.message}</p>}
        </form>
      </div>
    </div>
  )
}

export default EditClassModal
