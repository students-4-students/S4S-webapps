import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Select, Button } from '@s4s/ui'

const defaultForm = { title: '', description: '', location: '', category: '', severity: 'LOW' as const }

interface Props {
  onClose: () => void
}

function CreateIncidentModal({ onClose }: Props) {
  const utils = trpc.useUtils()
  const [form, setForm] = useState(defaultForm)

  const create = trpc.incidents.create.useMutation({
    onSuccess: () => {
      utils.incidents.list.invalidate()
      onClose()
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create.mutate({
      title: form.title,
      description: form.description,
      location: form.location || undefined,
      category: form.category || undefined,
      severity: form.severity,
    })
  }

  return (
    <Modal isOpen onClose={onClose} title="Nouvel incident" size="md">
      <form onSubmit={handleSubmit}>
        <Input
          label="Titre"
          required
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />

        <div className="s4s-form-field">
          <label className="s4s-label">Description *</label>
          <textarea
            required
            rows={3}
            className="s4s-textarea"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>

        <Input
          label="Lieu"
          value={form.location}
          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
        />

        <Select
          label="Catégorie"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          <option value="">—</option>
          <option value="Matériel">Matériel</option>
          <option value="Problèmes techniques">Problèmes techniques</option>
          <option value="Logistique">Logistique</option>
          <option value="Catering">Catering</option>
          <option value="RH">RH</option>
          <option value="Exercices">Exercices</option>
          <option value="Cours">Cours</option>
        </Select>

        <Select
          label="Sévérité"
          value={form.severity}
          onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))}
        >
          <option value="LOW">Faible</option>
          <option value="MEDIUM">Moyen</option>
          <option value="HIGH">Élevé</option>
        </Select>

        {create.isError && <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>{create.error.message}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" isLoading={create.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateIncidentModal
