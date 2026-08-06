import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Button, MultiSelectCombobox } from '@s4s/ui'

interface Props {
  initialData?: any
  onClose: () => void
}

export default function ClassDriveConfigModal({ initialData, onClose }: Props) {
  const utils = trpc.useUtils()

  const [id, setId] = useState(initialData?.id || '')
  const [name, setName] = useState(initialData?.name || '')
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>(
    initialData?.Section?.map((s: any) => s.id) || []
  )
  const [selectedRWStaffIds, setSelectedRWStaffIds] = useState<string[]>(
    initialData?.readWriteStaff?.map((s: any) => s.id) || []
  )
  const [selectedROStaffIds, setSelectedROStaffIds] = useState<string[]>(
    initialData?.readOnlyStaff?.map((s: any) => s.id) || []
  )

  // Use the staffs / students router
  const { data: sections = [] } = trpc.students.listSections.useQuery()
  const { data: staffs = [] } = trpc.staffs.list.useQuery()

  const createMutation = trpc.drive.createClass.useMutation({
    onSuccess: () => {
      utils.drive.listClasses.invalidate()
      onClose()
    },
  })

  const updateMutation = trpc.drive.updateClass.useMutation({
    onSuccess: () => {
      utils.drive.listClasses.invalidate()
      onClose()
    },
  })

  const deleteMutation = trpc.drive.deleteClass.useMutation({
    onSuccess: () => {
      utils.drive.listClasses.invalidate()
      onClose()
    },
  })

  const sectionOptions = sections.map((sec) => ({
    id: sec.id,
    label: sec.name,
  }))

  const staffOptions = staffs.map((st) => ({
    id: st.id,
    label: `${st.firstName} ${st.lastName} (${st.role})`,
  }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!id || !name) {
      alert('Veuillez remplir le code de la classe et le nom.')
      return
    }

    const payload = {
      id: id.trim(),
      name: name.trim(),
      sectionIds: selectedSectionIds,
      readWriteStaffIds: selectedRWStaffIds,
      readOnlyStaffIds: selectedROStaffIds,
    }

    if (initialData) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = () => {
    if (window.confirm(`Supprimer la classe "${initialData.name}" ? Tous ses fichiers et dossiers associés seront perdus.`)) {
      deleteMutation.mutate({ id: initialData.id })
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={initialData ? 'Configurer la classe' : 'Créer une classe'}
      size="md"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Input
          label="Nom de la classe"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!initialData) {
              setId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'))
            }
          }}
          placeholder="Ex: Analyse I, Physique générale..."
        />

        <div className="s4s-form-field">
          <label className="s4s-label">Sections associées (Accès en lecture pour leurs étudiants)</label>
          <MultiSelectCombobox
            options={sectionOptions}
            selectedIds={selectedSectionIds}
            onChange={setSelectedSectionIds}
            placeholder="Sélectionner les sections..."
          />
        </div>

        <div className="s4s-form-field">
          <label className="s4s-label">Staffs avec accès Écriture (Création de dossiers / Upload)</label>
          <MultiSelectCombobox
            options={staffOptions}
            selectedIds={selectedRWStaffIds}
            onChange={setSelectedRWStaffIds}
            placeholder="Sélectionner les staffs R/W..."
          />
        </div>

        <div className="s4s-form-field">
          <label className="s4s-label">Staffs avec accès Lecture seule</label>
          <MultiSelectCombobox
            options={staffOptions}
            selectedIds={selectedROStaffIds}
            onChange={setSelectedROStaffIds}
            placeholder="Sélectionner les staffs R/O..."
          />
        </div>

        {(createMutation.isError || updateMutation.isError || deleteMutation.isError) && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.875rem', margin: 0 }}>
            {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
          <div>
            {initialData && (
              <Button type="button" variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>
                Supprimer
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending || updateMutation.isPending}>
              {initialData ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
