import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { trpc } from '../trpc'
import '../../styles/dashboard.css'

const SEVERITY_COLOR: Record<string, string> = {
  LOW: '#27ae60',
  MEDIUM: '#f39c12',
  HIGH: '#e74c3c',
}

const CATEGORIES = ['Matériel', 'Problèmes techniques', 'Logistique', 'Catering', 'RH', 'Exercices', 'Cours']

function IncidentDetail() {
  const { incidentId } = useParams({ from: '/incidents/$incidentId' })
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: incident, isLoading } = trpc.incidents.getById.useQuery({ id: incidentId })

  const update = trpc.incidents.update.useMutation({
    onSuccess: () => utils.incidents.getById.invalidate({ id: incidentId }),
  })

  const deleteMutation = trpc.incidents.delete.useMutation({
    onSuccess: async () => {
      navigate({ to: '/incidents' })
      await utils.incidents.list.invalidate()
      await utils.incidents.getById.invalidate({ id: incidentId })
    },
  })

  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    category: '',
    severity: 'LOW' as 'LOW' | 'MEDIUM' | 'HIGH',
    status: 'OPEN' as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
  })

  useEffect(() => {
    if (incident) {
      setForm({
        title: incident.title,
        description: incident.description,
        location: incident.location ?? '',
        category: incident.category ?? '',
        severity: incident.severity,
        status: incident.status,
      })
    }
  }, [incident])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    update.mutate({
      id: incidentId,
      title: form.title,
      description: form.description,
      location: form.location || undefined,
      category: form.category || undefined,
      severity: form.severity,
      status: form.status,
    })
  }

  function handleDelete() {
    if (!window.confirm(`Supprimer l'incident « ${incident?.title ?? 'ce ticket'} » ?`)) {
      return
    }

    deleteMutation.mutate({ id: incidentId })
  }

  if (isLoading) return <div className='dashboard'><p>Chargement…</p></div>
  if (!incident) return <div className='dashboard'><p>Incident introuvable.</p></div>

  return (
    <div className='dashboard' style={{ position: 'relative' }}>
      <div className='col' style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0, flex: 1 }}>{incident.title}</h1>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: SEVERITY_COLOR[incident.severity],
            flexShrink: 0,
          }} />
        </div>

        <div style={{ fontSize: '0.8rem', color: '#888' }}>
          Signalé par <strong>{incident.reportedBy.firstName} {incident.reportedBy.lastName}</strong>
          {incident.reportedBy.telegramUsername && ` · ${incident.reportedBy.telegramUsername}`}
          {' · '}
          {new Date(incident.createdAt).toLocaleString('fr-CH')}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Titre
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Lieu
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
            Description
            <textarea
              required
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '0.4rem', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Catégorie
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.4rem', fontFamily: 'inherit', fontSize: '0.9rem', background: 'white' }}
              >
                <option value=''>—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Sévérité
              <select
                value={form.severity}
                onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as typeof form.severity }))}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.4rem', fontFamily: 'inherit', fontSize: '0.9rem', background: 'white' }}
              >
                <option value='LOW'>Faible</option>
                <option value='MEDIUM'>Moyen</option>
                <option value='HIGH'>Élevé</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Statut
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as typeof form.status }))}
                style={{ padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '0.4rem', fontFamily: 'inherit', fontSize: '0.9rem', background: 'white' }}
              >
                <option value='OPEN'>Ouvert</option>
                <option value='IN_PROGRESS'>En cours</option>
                <option value='RESOLVED'>Résolu</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type='submit' className='btn-primary' disabled={update.isPending}>
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type='button' className='btn-secondary' onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
            </button>
            {update.isSuccess && <span style={{ fontSize: '0.85rem', color: '#27ae60' }}>Modifications enregistrées</span>}
            {update.isError && <span style={{ fontSize: '0.85rem', color: '#c0392b' }}>{update.error.message}</span>}
          </div>

        </form>
      </div>

      <Link to='/incidents' style={{ position: 'absolute', bottom: '1.5rem', left: '1.5rem', color: 'var(--primary-purple)', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
        ← Incidents
      </Link>
    </div>
  )
}

export default IncidentDetail
