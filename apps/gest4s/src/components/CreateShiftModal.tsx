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
  defaultStaffId?: string
  onClose: () => void
}

export default function CreateShiftModal({ defaultStaffId = '', onClose }: Props) {
  const utils = trpc.useUtils()

  const [staffMemberId, setStaffMemberId] = useState(defaultStaffId)
  const [shiftType, setShiftType] = useState('Logistique')
  const [day, setDay] = useState('2026-08-26')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('12:00')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const createMutation = trpc.shifts.create.useMutation({
    onSuccess: () => {
      utils.shifts.list.invalidate()
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!staffMemberId) {
      alert('Veuillez sélectionner un membre du staff.')
      return
    }

    const startStr = `${day}T${startTime}:00`
    const endStr = `${day}T${endTime}:00`

    createMutation.mutate({
      staffMemberId,
      type: shiftType,
      startTime: new Date(startStr),
      endTime: new Date(endStr),
      location: location || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <Modal isOpen onClose={onClose} title="Ajouter un shift" size="lg">
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

        {createMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>
            {createMutation.error.message}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            Créer le shift
          </Button>
        </div>
      </form>
    </Modal>
  )
}
