import { useState, useMemo, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import '../../styles/workshops.css'

interface WorkshopSession {
  id: string
  startTime: Date | string
  endTime: Date | string
}

interface Workshop {
  id: string
  title: string
  location: string
  description: string
  image: string | null
  requiresRegistration: boolean
  maxParticipants: number | null
  dates: WorkshopSession[]
}

// Format Date object or ISO string to 'YYYY-MM-DDTHH:mm' in local timezone
function toLocalDatetimeString(dateVal: Date | string): string {
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  const year = d.getFullYear()
  const month = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

// Convert 'YYYY-MM-DDTHH:mm' local string to ISO string for backend
function toISOStringFromLocal(localStr: string): string {
  const d = new Date(localStr)
  return d.toISOString()
}

export default function Workshops() {
  const [showModal, setShowModal] = useState(false)
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null)
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'required' | 'open'>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all')

  // Drag and Drop & Image tab state
  const [isDragging, setIsDragging] = useState(false)
  const [imageTab, setImageTab] = useState<'file' | 'url'>('file')

  // Form State
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [requiresRegistration, setRequiresRegistration] = useState(false)
  const [maxParticipants, setMaxParticipants] = useState<number | ''>('')
  const [dates, setDates] = useState<{ startTime: string; endTime: string }[]>([])

  const utils = trpc.useUtils()

  // Queries & Mutations
  const { data: workshops = [], isLoading } = trpc.workshops.list.useQuery()

  // Real-time Updates via tRPC Subscription
  trpc.workshops.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.workshops.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Workshops subscription error:', err)
    }
  })

  const createMutation = trpc.workshops.create.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
      closeModal()
    }
  })

  const updateMutation = trpc.workshops.update.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
      closeModal()
    }
  })

  const deleteMutation = trpc.workshops.delete.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    }
  })

  // Keyboard shortcut (Escape to close modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        closeModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showModal])

  const openCreateModal = () => {
    setEditingWorkshop(null)
    setTitle('')
    setLocation('')
    setDescription('')
    setImage('')
    setImageTab('file')
    setRequiresRegistration(false)
    setMaxParticipants('')
    
    // Pre-populate with current local date/time, and end time in 2 hours
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    setDates([{ 
      startTime: toLocalDatetimeString(now), 
      endTime: toLocalDatetimeString(twoHoursLater) 
    }])
    
    setShowModal(true)
  }

  const openEditModal = (w: Workshop) => {
    setEditingWorkshop(w)
    setTitle(w.title)
    setLocation(w.location)
    setDescription(w.description)
    setImage(w.image || '')
    setImageTab(w.image && !w.image.startsWith('data:') ? 'url' : 'file')
    setRequiresRegistration(w.requiresRegistration)
    setMaxParticipants(w.maxParticipants ?? '')
    
    const sortedDates = [...(w.dates || [])].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    setDates(
      sortedDates.map(d => ({
        startTime: toLocalDatetimeString(d.startTime),
        endTime: toLocalDatetimeString(d.endTime)
      }))
    )
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingWorkshop(null)
    setIsDragging(false)
  }

  // Image Upload Processing
  const processFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert("L'image est trop volumineuse (maximum 2 Mo).")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processFile(file)
    }
  }

  // Session Dates Management
  const handleAddDate = () => {
    const now = new Date()
    let startStr = toLocalDatetimeString(now)
    let endStr = toLocalDatetimeString(new Date(now.getTime() + 2 * 60 * 60 * 1000))

    if (dates.length > 0) {
      const lastEnd = new Date(dates[dates.length - 1].endTime)
      if (!isNaN(lastEnd.getTime())) {
        startStr = toLocalDatetimeString(lastEnd)
        endStr = toLocalDatetimeString(new Date(lastEnd.getTime() + 2 * 60 * 60 * 1000))
      }
    }
    
    setDates([...dates, { startTime: startStr, endTime: endStr }])
  }

  const handleRemoveDate = (index: number) => {
    setDates(dates.filter((_, i) => i !== index))
  }

  const handleDateChange = (index: number, field: 'startTime' | 'endTime', val: string) => {
    const updated = [...dates]
    updated[index] = {
      ...updated[index],
      [field]: val
    }
    setDates(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (dates.length === 0) {
      alert("Veuillez ajouter au moins une session pour le workshop.")
      return
    }

    // Verify endTimes are after startTimes & values are present
    for (let i = 0; i < dates.length; i++) {
      if (!dates[i].startTime || !dates[i].endTime) {
        alert(`Session #${i + 1}: Veuillez renseigner l'heure de début et de fin.`)
        return
      }
      const start = new Date(dates[i].startTime)
      const end = new Date(dates[i].endTime)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert(`Session #${i + 1}: Date/heure invalide.`)
        return
      }
      if (end <= start) {
        alert(`Session #${i + 1}: L'heure de fin doit être postérieure à l'heure de début.`)
        return
      }
    }

    const payload = {
      title: title.trim(),
      location: location.trim(),
      description: description.trim(),
      image: image.trim() || undefined,
      requiresRegistration,
      maxParticipants: requiresRegistration && maxParticipants !== '' ? Number(maxParticipants) : null,
      dates: dates.map(d => ({
        startTime: toISOStringFromLocal(d.startTime),
        endTime: toISOStringFromLocal(d.endTime)
      }))
    }

    if (editingWorkshop) {
      updateMutation.mutate({
        id: editingWorkshop.id,
        ...payload
      })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le workshop "${title}" ?`)) {
      deleteMutation.mutate({ id })
    }
  }

  // Format date-time range in French Switzerland locale
  const formatDateTimeRange = (startTimeVal: string | Date, endTimeVal: string | Date) => {
    const start = new Date(startTimeVal)
    const end = new Date(endTimeVal)
    const locale = 'fr-CH'
    
    const isSameDay = start.toDateString() === end.toDateString()
    
    const startStr = start.toLocaleString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    
    if (isSameDay) {
      const endStr = end.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit'
      })
      return `${startStr} - ${endStr}`
    } else {
      const endStr = end.toLocaleString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
      return `${startStr} - ${endStr}`
    }
  }

  // Filtered Workshops
  const filteredWorkshops = useMemo(() => {
    const now = new Date().getTime()

    return workshops.filter(w => {
      // Search filter
      const matchesSearch = 
        !searchQuery ||
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())

      // Registration filter
      const matchesReg = 
        registrationFilter === 'all' ||
        (registrationFilter === 'required' && w.requiresRegistration) ||
        (registrationFilter === 'open' && !w.requiresRegistration)

      // Time filter (upcoming vs past)
      let matchesTime = true
      if (timeFilter !== 'all') {
        const hasUpcomingSession = w.dates.some(d => new Date(d.endTime).getTime() > now)
        if (timeFilter === 'upcoming') {
          matchesTime = hasUpcomingSession
        } else if (timeFilter === 'past') {
          matchesTime = !hasUpcomingSession
        }
      }

      return matchesSearch && matchesReg && matchesTime
    })
  }, [workshops, searchQuery, registrationFilter, timeFilter])

  const hasActiveFilters = searchQuery !== '' || registrationFilter !== 'all' || timeFilter !== 'all'

  return (
    <div className="workshops-page">
      {/* Top Header */}
      <div className="workshops-header">
        <div>
          <h1>Gestion des Workshops</h1>
        </div>
        <button className="btn-create-workshop" onClick={openCreateModal}>
          <span>+ Créer un workshop</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="workshops-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par titre, lieu, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filter-group">
          <select
            value={registrationFilter}
            onChange={(e) => setRegistrationFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Toutes les inscriptions</option>
            <option value="open">🟢 Entrée libre</option>
            <option value="required">📝 Inscription requise</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">Toutes les dates</option>
            <option value="upcoming">⏳ À venir / En cours</option>
            <option value="past">🏁 Passés</option>
          </select>

          {hasActiveFilters && (
            <button
              className="btn-reset-filters"
              onClick={() => {
                setSearchQuery('')
                setRegistrationFilter('all')
                setTimeFilter('all')
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Container for Workshops */}
      <div className="workshops-content-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Chargement des workshops…</p>
          </div>
        ) : filteredWorkshops.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🎨</div>
            {hasActiveFilters ? (
              <>
                <h3>Aucun workshop ne correspond à votre recherche</h3>
                <p>Essayez de modifier vos filtres ou termes de recherche.</p>
                <button
                  className="btn-reset-filters-large"
                  onClick={() => {
                    setSearchQuery('')
                    setRegistrationFilter('all')
                    setTimeFilter('all')
                  }}
                >
                  Effacer tous les filtres
                </button>
              </>
            ) : (
              <>
                <h3>Aucun workshop créé pour le moment</h3>
                <p>Commencez par ajouter le premier workshop de la semaine d'intégration.</p>
                <button className="btn-create-workshop" onClick={openCreateModal}>
                  + Créer le premier workshop
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="workshops-grid">
            {filteredWorkshops.map((w: Workshop) => {
              const sortedDates = [...(w.dates || [])].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              )

              return (
                <div key={w.id} className="workshop-card">
                  <div className="workshop-image-container">
                    {w.image ? (
                      <img
                        src={w.image}
                        alt={w.title}
                        className="workshop-image"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="workshop-placeholder-image">
                        <span>🎨</span>
                      </div>
                    )}
                    <div className="workshop-badge-row">
                      {w.requiresRegistration ? (
                        <span className="badge badge-registration">
                          📝 Inscription requise {w.maxParticipants ? `(${w.maxParticipants} max)` : ''}
                        </span>
                      ) : (
                        <span className="badge badge-open">
                          🟢 Entrée libre
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="workshop-details">
                    <h2 className="workshop-title">{w.title}</h2>
                    
                    <div className="workshop-location">
                      📍 <span>{w.location}</span>
                    </div>

                    <p className="workshop-description">{w.description}</p>

                    <div className="workshop-dates-section">
                      <h3 className="workshop-dates-title">
                        Sessions ({sortedDates.length})
                      </h3>
                      <div className="workshop-dates-list">
                        {sortedDates.length === 0 ? (
                          <span className="no-sessions">Aucune session définie</span>
                        ) : (
                          sortedDates.map((d) => (
                            <div key={d.id} className="workshop-date-chip">
                              📅 {formatDateTimeRange(d.startTime, d.endTime)}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="workshop-actions">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => openEditModal(w)}
                        title="Modifier"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(w.id, w.title)}
                        title="Supprimer"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Link back to Dashboard */}
      <div className="workshops-footer">
        <Link to="/" className="btn-back-dashboard">
          ← Retour au Dashboard
        </Link>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal workshop-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>{editingWorkshop ? 'Modifier le workshop' : 'Créer un workshop'}</h2>
              <button className="modal-close-btn" onClick={closeModal}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Titre du workshop *
                <input
                  type="text"
                  required
                  placeholder="Titre du workshop"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label>
                Lieu *
                <input
                  type="text"
                  required
                  placeholder="Ex: Salle BC 420"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>

              <label>
                Description *
                <textarea
                  required
                  rows={4}
                  placeholder="Décrivez le workshop"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="modal-registration-box">
                <span className="modal-section-title">Options d'inscription</span>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={requiresRegistration}
                    onChange={(e) => {
                      setRequiresRegistration(e.target.checked)
                      if (!e.target.checked) setMaxParticipants('')
                    }}
                  />
                  <span>Requiert une inscription préalable</span>
                </label>

                {requiresRegistration && (
                  <label className="sub-label">
                    Nombre maximal de participants (laisser vide si illimité)
                    <input
                      type="number"
                      min={1}
                      placeholder="Ex: 25"
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(e.target.value !== '' ? Number(e.target.value) : '')}
                    />
                  </label>
                )}
              </div>

              {/* Image Input Section */}
              <div className="modal-image-box">
                <div className="modal-image-header">
                  <span className="modal-section-title">Image du workshop</span>
                  <div className="image-tab-buttons">
                    <button
                      type="button"
                      className={`tab-btn ${imageTab === 'file' ? 'active' : ''}`}
                      onClick={() => setImageTab('file')}
                    >
                      Fichier / Fait glisser
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${imageTab === 'url' ? 'active' : ''}`}
                      onClick={() => setImageTab('url')}
                    >
                      Lien URL
                    </button>
                  </div>
                </div>

                {image ? (
                  <div className="image-preview-container">
                    <img src={image} alt="Aperçu workshop" />
                    <button
                      type="button"
                      className="btn-remove-image"
                      onClick={() => setImage('')}
                      title="Supprimer l'image"
                    >
                      ✕
                    </button>
                  </div>
                ) : imageTab === 'url' ? (
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    className="url-image-input"
                  />
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`dropzone ${isDragging ? 'dragging' : ''}`}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="file-input-overlay"
                      onChange={handleImageChange}
                    />
                    <span className="dropzone-icon">📷</span>
                    <span className="dropzone-text">
                      Glissez-déposez une image ici ou cliquez pour choisir
                    </span>
                    <span className="dropzone-subtext">
                      Format PNG, JPG, WebP (max 2 Mo)
                    </span>
                  </div>
                )}
              </div>

              {/* Dates / Sessions Section */}
              <div className="modal-dates-manager">
                <div className="modal-dates-header">
                  <span className="modal-section-title">Sessions du workshop *</span>
                  <button
                    type="button"
                    className="btn-add-date"
                    onClick={handleAddDate}
                  >
                    + Ajouter une session
                  </button>
                </div>

                <div className="dates-list-container">
                  {dates.map((d, index) => (
                    <div key={index} className="date-input-card">
                      <div className="date-input-header">
                        <span className="session-index-badge">Session #{index + 1}</span>
                        {dates.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove-date"
                            onClick={() => handleRemoveDate(index)}
                          >
                            Supprimer
                          </button>
                        )}
                      </div>

                      <div className="date-input-fields">
                        <label>
                          Début
                          <input
                            type="datetime-local"
                            required
                            value={d.startTime}
                            onChange={(e) => handleDateChange(index, 'startTime', e.target.value)}
                          />
                        </label>

                        <label>
                          Fin
                          <input
                            type="datetime-local"
                            required
                            value={d.endTime}
                            onChange={(e) => handleDateChange(index, 'endTime', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={closeModal}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
