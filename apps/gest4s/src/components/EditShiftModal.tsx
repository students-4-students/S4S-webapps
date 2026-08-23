import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Select, Button } from '@s4s/ui'
import StaffCombobox from './StaffCombobox'

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

const SHIFT_TYPES = [
  'Logistique',
  'Catering',
  'Animation',
  'Communication',
  'Staff',
  'RC',
  'Speaker',
  'Assistanat',
]

interface Props {
  shift: any
  onClose: () => void
}

export default function EditShiftModal({ shift, onClose }: Props) {
  const utils = trpc.useUtils()

  const startObj = new Date(shift.startTime)
  const endObj = new Date(shift.endTime)

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

  const rawShift = shift.rawShift || shift

  const [staffMemberId, setStaffMemberId] = useState(rawShift.staffMemberId || '')
  const [shiftType, setShiftType] = useState(rawShift.type || 'Logistique')
  const [day, setDay] = useState(formatYYYYMMDD(startObj))
  const [startTime, setStartTime] = useState(formatHHMM(startObj))
  const [endTime, setEndTime] = useState(formatHHMM(endObj))
  const [location, setLocation] = useState(rawShift.location || '')
  const [notes, setNotes] = useState(rawShift.notes || '')

  const updateMutation = trpc.shifts.update.useMutation({
    onSuccess: () => {
      utils.shifts.list.invalidate()
      onClose()
    },
  })

  const deleteMutation = trpc.shifts.delete.useMutation({
    onSuccess: () => {
      utils.shifts.list.invalidate()
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const startStr = `${day}T${startTime}:00`
    const endStr = `${day}T${endTime}:00`

    updateMutation.mutate({
      id: rawShift.id,
      staffMemberId,
      type: shiftType,
      startTime: new Date(startStr),
      endTime: new Date(endStr),
      location: location || null,
      notes: notes || null,
    })
  }

  function handleDelete() {
    if (confirm('Voulez-vous vraiment supprimer ce shift ?')) {
      deleteMutation.mutate({ id: rawShift.id })
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Modifier le shift" size="lg">
      <form onSubmit={handleSubmit}>
        <StaffCombobox
          label="Membre du staff *"
          value={staffMemberId}
          onChange={setStaffMemberId}
          allowUnassigned={false}
          required
        />

        <Select
          label="Type de shift *"
          value={shiftType}
          onChange={(e) => setShiftType(e.target.value)}
        >
          {SHIFT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ flex: 2 }}>
            <Select label="Jour *" value={day} onChange={(e) => setDay(e.target.value)}>
              {DAYS.map((d) => (
                <option key={d.dateStr} value={d.dateStr}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Heure début *"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Heure fin *"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <Input
          label="Lieu"
          placeholder="Ex: RLC, Esplanade"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />

        <Input
          label="Description / Notes"
          placeholder="Ex: Distribution des t-shirts, Accueil"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {updateMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>
            {updateMutation.error.message}
          </p>
        )}
        {deleteMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>
            {deleteMutation.error.message}
          </p>
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
            <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
              Enregistrer
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
