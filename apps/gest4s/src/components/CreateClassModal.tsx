import React, { useState } from 'react'
import { trpc } from '../trpc'
import { Modal, Input, Select, Button } from '@s4s/ui'
import StaffCombobox from './StaffCombobox'

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
  initialData?: any
  onClose: () => void
}

function CreateClassModal({ defaultSection, initialData, onClose }: Props) {
  const utils = trpc.useUtils()

  const [title, setTitle] = useState(initialData?.title || '')
  const [type, setType] = useState<'LECTURE' | 'EXERCISE' | 'SPECIAL' | 'MEAL'>(
    initialData?.type || 'LECTURE'
  )
  const [selectedSections, setSelectedSections] = useState<string[]>([
    initialData?.section?.name
      ? initialData.section.name.toUpperCase()
      : defaultSection && SECTIONS.includes(defaultSection.toUpperCase())
        ? defaultSection.toUpperCase()
        : 'CMS',
  ])

  const formatHHMM = (dStr: string | Date) => {
    const d = new Date(dStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatYYYYMMDD = (dStr: string | Date) => {
    const d = new Date(dStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const [sessions, setSessions] = useState<Session[]>(
    initialData
      ? [
          {
            id: '1',
            day: formatYYYYMMDD(initialData.startTime),
            startTime: formatHHMM(initialData.startTime),
            endTime: formatHHMM(initialData.endTime),
            location: initialData.location || '',
          },
        ]
      : [{ id: '1', day: '2026-08-26', startTime: '08:00', endTime: '10:00', location: '' }]
  )

  const [speakerId, setSpeakerId] = useState<string>(
    initialData?.speakerId || initialData?.speaker?.id || ''
  )
  const [assistantId, setAssistantId] = useState<string>(
    initialData?.assistantId || initialData?.assistant?.id || ''
  )
  const [rcId, setRcId] = useState<string>(initialData?.rcId || initialData?.rc?.id || '')

  const firstSession = sessions[0]
  const conflictQuery = trpc.schedules.checkConflicts.useQuery(
    {
      startTime: new Date(`${firstSession?.day}T${firstSession?.startTime}:00`),
      endTime: new Date(`${firstSession?.day}T${firstSession?.endTime}:00`),
      location: firstSession?.location || undefined,
      sectionId: selectedSections[0] || undefined,
    },
    {
      enabled: Boolean(firstSession?.day && firstSession?.startTime && firstSession?.endTime),
    }
  )
  const conflicts = conflictQuery.data || []

  const { data: staffs = [] } = trpc.staffs.list.useQuery()
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
              speakerId: speakerId || undefined,
              assistantId: assistantId || undefined,
              rcId: rcId || undefined,
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
    <Modal isOpen onClose={onClose} title="Créer un cours" size="lg">
      <form onSubmit={handleSubmit}>
        {conflicts.length > 0 && (
          <div
            style={{
              marginBottom: '1.25rem',
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--s4s-danger)',
              borderRadius: 'var(--s4s-radius-md)',
              color: '#f87171',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>⚠️ Conflit(s) de réservation ({conflicts.length})</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {conflicts.map((c: any, idx: number) => (
                <li key={idx}>{c.message}</li>
              ))}
            </ul>
          </div>
        )}

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          <StaffCombobox
            label="Speaker"
            value={speakerId}
            onChange={setSpeakerId}
            placeholder="Rechercher speaker..."
            defaultCategory="Speaker"
          />

          <StaffCombobox
            label="Assistant"
            value={assistantId}
            onChange={setAssistantId}
            placeholder="Rechercher assistant..."
            defaultCategory="Assistant"
          />

          <StaffCombobox
            label="RC (Responsable)"
            value={rcId}
            onChange={setRcId}
            placeholder="Rechercher RC..."
            defaultCategory="RC"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label className="s4s-label">Sections * (Sélectionnez au moins une)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.375rem' }}>
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
                    borderRadius: 'var(--s4s-radius-sm)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--s4s-primary)' : 'var(--s4s-border)',
                    background: isSelected ? 'var(--s4s-primary)' : 'transparent',
                    color: isSelected ? 'white' : 'var(--s4s-text-primary)',
                    cursor: 'pointer',
                    transition: 'all var(--s4s-transition-fast)',
                    textAlign: 'center'
                  }}
                >
                  {sec}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label className="s4s-label">Sessions *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.375rem' }}>
            {sessions.map((sess) => (
              <div
                key={sess.id}
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                  padding: '0.5rem',
                  background: 'var(--s4s-bg-subtle)',
                  borderRadius: 'var(--s4s-radius-md)',
                  border: '1px solid var(--s4s-border)'
                }}
              >
                <select
                  className="s4s-select"
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
                  className="s4s-input"
                  style={{ flex: 1, padding: '0.3rem', minWidth: '65px' }}
                  value={sess.startTime}
                  onChange={(e) => updateSession(sess.id, 'startTime', e.target.value)}
                />

                <span style={{ fontSize: '0.8rem', color: 'var(--s4s-text-muted)' }}>à</span>

                <input
                  type="time"
                  required
                  className="s4s-input"
                  style={{ flex: 1, padding: '0.3rem', minWidth: '65px' }}
                  value={sess.endTime}
                  onChange={(e) => updateSession(sess.id, 'endTime', e.target.value)}
                />

                <input
                  type="text"
                  placeholder="Salle (ex: CO2)"
                  className="s4s-input"
                  style={{ flex: 1.2, padding: '0.3rem', minWidth: '80px' }}
                  value={sess.location}
                  onChange={(e) => updateSession(sess.id, 'location', e.target.value)}
                />

                {sessions.length > 1 && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeSession(sess.id)}
                    style={{ padding: '0.3rem 0.5rem', minWidth: 'auto', height: 'auto' }}
                  >
                    🗑️
                  </Button>
                )}
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSession}
              style={{ marginTop: '0.2rem' }}
            >
              + Ajouter une session
            </Button>
          </div>
        </div>

        {createMutation.isError && (
          <p style={{ color: 'var(--s4s-danger)', fontSize: '0.85rem' }}>{createMutation.error.message}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
            Créer
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateClassModal
