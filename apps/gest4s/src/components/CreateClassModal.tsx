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

interface Session {
  id: string
  day: string
  startTime: string
  endTime: string
  location: string
}

interface Props {
  defaultSection: string
  onClose: () => void
}

function CreateClassModal({ defaultSection, onClose }: Props) {
  const utils = trpc.useUtils()

  // Form States
  const [title, setTitle] = useState('')
  const [type, setType] = useState<'LECTURE' | 'EXERCISE' | 'SPECIAL' | 'MEAL'>('LECTURE')
  const [selectedSections, setSelectedSections] = useState<string[]>([
    defaultSection && SECTIONS.includes(defaultSection.toUpperCase()) ? defaultSection.toUpperCase() : 'CMS'
  ])

  // Multiple Sessions State (now includes location per session)
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', day: '2026-08-26', startTime: '08:00', endTime: '10:00', location: '' }
  ])

  const createMutation = trpc.schedules.create.useMutation()

  const addSession = () => {
    const lastSession = sessions[sessions.length - 1]
    const newId = String(Date.now() + Math.random())
    setSessions([
      ...sessions,
      {
        id: newId,
        day: lastSession ? lastSession.day : '2026-08-26',
        startTime: lastSession ? lastSession.startTime : '08:00',
        endTime: lastSession ? lastSession.endTime : '10:00',
        location: lastSession ? lastSession.location : ''
      }
    ])
  }

  const removeSession = (id: string) => {
    if (sessions.length > 1) {
      setSessions(sessions.filter((s) => s.id !== id))
    }
  }

  const updateSession = (id: string, field: keyof Session, value: string) => {
    setSessions(sessions.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const toggleSection = (sec: string) => {
    if (selectedSections.includes(sec)) {
      setSelectedSections(selectedSections.filter((s) => s !== sec))
    } else {
      setSelectedSections([...selectedSections, sec])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selectedSections.length === 0) {
      alert('Veuillez sélectionner au moins une section.')
      return
    }

    try {
      const promises = []
      for (const sec of selectedSections) {
        for (const sess of sessions) {
          const startStr = `${sess.day}T${sess.startTime}:00`
          const endStr = `${sess.day}T${sess.endTime}:00`

          promises.push(
            createMutation.mutateAsync({
              title,
              type,
              startTime: new Date(startStr),
              endTime: new Date(endStr),
              location: sess.location || undefined,
              sectionId: sec,
            })
          )
        }
      }
      await Promise.all(promises)
      utils.schedules.list.invalidate()
      onClose()
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className='modal-overlay' onClick={onClose}>
      <div className='modal' style={{ width: '480px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h2>Créer un cours</h2>
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

          {/* Section Selector Grid */}
          <label style={{ marginTop: '0.25rem' }}>
            Sections * (Sélectionnez au moins une)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.25rem' }}>
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
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--secondary-purple)' : '#ddd',
                    background: isSelected ? 'var(--primary-purple)' : 'transparent',
                    color: isSelected ? 'white' : 'var(--primary-purple)',
                    cursor: 'pointer',
                    marginTop: 0,
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  {sec}
                </button>
              )
            })}
          </div>

          {/* Sessions List */}
          <label style={{ marginTop: '0.8rem' }}>Sessions *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
            {sessions.map((sess) => (
              <div
                key={sess.id}
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  border: '1px solid #eee'
                }}
              >
                <select
                  style={{ flex: 1.5, padding: '0.3rem' }}
                  value={sess.day}
                  onChange={(e) => updateSession(sess.id, 'day', e.target.value)}
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
                  style={{ flex: 1, padding: '0.3rem', minWidth: '65px' }}
                  value={sess.startTime}
                  onChange={(e) => updateSession(sess.id, 'startTime', e.target.value)}
                />

                <span style={{ fontSize: '0.8rem', color: '#666' }}>à</span>

                <input
                  type="time"
                  required
                  style={{ flex: 1, padding: '0.3rem', minWidth: '65px' }}
                  value={sess.endTime}
                  onChange={(e) => updateSession(sess.id, 'endTime', e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Salle (ex: CO2)"
                  style={{ flex: 1.2, padding: '0.3rem', minWidth: '80px' }}
                  value={sess.location}
                  onChange={(e) => updateSession(sess.id, 'location', e.target.value)}
                />

                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSession(sess.id)}
                    style={{
                      padding: '0.3rem 0.5rem',
                      background: '#e74c3c',
                      color: 'white',
                      borderRadius: '4px',
                      marginTop: 0,
                      fontSize: '0.8rem'
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addSession}
              style={{
                padding: '0.4rem',
                background: 'transparent',
                border: '1px dashed var(--primary-purple)',
                color: 'var(--primary-purple)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                marginTop: '0.2rem',
                transition: 'all 0.2s ease',
              }}
            >
              + Ajouter une session
            </button>
          </div>

          <div className='modal-actions' style={{ marginTop: '1.5rem' }}>
            <button type='button' onClick={onClose}>Annuler</button>
            <button type='submit' className='btn-primary' disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Création…' : 'Créer'}
            </button>
          </div>
          {createMutation.isError && <p className='error'>{createMutation.error.message}</p>}
        </form>
      </div>
    </div>
  )
}

export default CreateClassModal
