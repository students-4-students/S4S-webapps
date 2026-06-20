import React, { useState } from 'react'
import { trpc } from '../trpc'

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
    <div className='modal-overlay' onClick={onClose}>
      <div className='modal' onClick={(e) => e.stopPropagation()}>
        <h2>Nouvel incident</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Titre *
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </label>
          <label>
            Description *
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label>
            Lieu
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            />
          </label>
          <label>
            Catégorie
            <input
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </label>
          <label>
            Sévérité
            <select
              value={form.severity}
              onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))}
            >
              <option value='LOW'>Faible</option>
              <option value='MEDIUM'>Moyen</option>
              <option value='HIGH'>Élevé</option>
            </select>
          </label>
          <div className='modal-actions'>
            <button type='button' onClick={onClose}>Annuler</button>
            <button type='submit' className='btn-primary' disabled={create.isPending}>
              {create.isPending ? 'Envoi…' : 'Créer'}
            </button>
          </div>
          {create.isError && <p className='error'>{create.error.message}</p>}
        </form>
      </div>
    </div>
  )
}

export default CreateIncidentModal
