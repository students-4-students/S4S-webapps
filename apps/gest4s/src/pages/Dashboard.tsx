import React, { useState } from 'react'
import { useAuthStore } from '../store/auth'
import { trpc } from '../trpc'
import IncidentCard from '../components/IncidentCard'
import '../../styles/dashboard.css'

const defaultForm = { title: '', description: '', location: '', category: '', severity: 'LOW' as const }

function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const utils = trpc.useUtils()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(defaultForm)

  const { data: incidents = [], isLoading } = trpc.incidents.list.useQuery()

  trpc.incidents.onCreated.useSubscription(undefined, {
    onData: () => utils.incidents.list.invalidate(),
  })

  const create = trpc.incidents.create.useMutation({
    onSuccess: () => {
      utils.incidents.list.invalidate()
      setShowForm(false)
      setForm(defaultForm)
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
    <div className='dashboard'>
      <div className='col' style={{ width: '25%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0 }}>Incidents</h1>
          <button className='btn-primary' onClick={() => setShowForm(true)}>+ Nouveau</button>
        </div>

        {isLoading && <p>Chargement…</p>}
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>

      {showForm && (
        <div className='modal-overlay' onClick={() => setShowForm(false)}>
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
                <button type='button' onClick={() => setShowForm(false)}>Annuler</button>
                <button type='submit' className='btn-primary' disabled={create.isPending}>
                  {create.isPending ? 'Envoi…' : 'Créer'}
                </button>
              </div>
              {create.isError && <p className='error'>{create.error.message}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
