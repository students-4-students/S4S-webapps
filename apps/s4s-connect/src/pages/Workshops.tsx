import { useState, useMemo, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'
import { useAuthStore } from '../store/auth'

interface WorkshopRegistration {
  id: string
  sessionId: string
  userId?: string | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isPresent: boolean
}

interface WorkshopSession {
  id: string
  startTime: Date | string
  endTime: Date | string
  registrations?: WorkshopRegistration[]
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
      minute: '2-digit',
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

export default function Workshops() {
  const [searchQuery, setSearchQuery] = useState('')
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'required' | 'open'>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const user = useAuthStore((state) => state.user)

  // Track registered slots in local state / localStorage
  const [registeredSlotIds, setRegisteredSlotIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('s4s_registered_slots')
      if (saved) return JSON.parse(saved)
      const oldSaved = localStorage.getItem('s4s_registered_workshops')
      return oldSaved ? JSON.parse(oldSaved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('s4s_registered_slots', JSON.stringify(registeredSlotIds))
    } catch (err) {
      console.error('Failed to save registered slots:', err)
    }
  }, [registeredSlotIds])

  // Fetch workshops with real DB registrations included
  const { data: workshops = [], isLoading, error } = trpc.workshops.list.useQuery()

  // Sync DB registrations into local registeredSlotIds state
  useEffect(() => {
    if (workshops.length > 0) {
      const dbRegisteredIds: string[] = []
      workshops.forEach((w: any) => {
        (w.dates || []).forEach((d: any) => {
          if (d.registrations && d.registrations.length > 0) {
            // Check if current user is registered or if saved locally
            const isUserReg = d.registrations.some((r: any) => r.sessionId === d.id || registeredSlotIds.includes(d.id))
            if (isUserReg) {
              dbRegisteredIds.push(d.id)
            }
          }
        })
      })
      if (dbRegisteredIds.length > 0) {
        setRegisteredSlotIds((prev) => Array.from(new Set([...prev, ...dbRegisteredIds])))
      }
    }
  }, [workshops])

  // tRPC Mutations for DB registration
  const registerMutation = trpc.workshops.register.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    },
    onError: (err) => {
      setToastMessage(err.message || 'Erreur lors de l’inscription')
      setTimeout(() => setToastMessage(null), 3500)
    },
  })

  const unregisterMutation = trpc.workshops.unregister.useMutation({
    onSuccess: () => {
      utils.workshops.list.invalidate()
    },
    onError: (err) => {
      setToastMessage(err.message || 'Erreur lors de la désinscription')
      setTimeout(() => setToastMessage(null), 3500)
    },
  })

  // Real-time Subscription to live updates
  trpc.workshops.onUpdated.useSubscription(undefined, {
    onData: () => {
      utils.workshops.list.invalidate()
    },
    onError: (err) => {
      console.error('[DEBUG] Workshops subscription error:', err)
    },
  })

  // Accurate available spots computed from database registrations
  const getSlotAvailableSpots = (
    session: WorkshopSession,
    maxParticipants: number | null
  ) => {
    if (!maxParticipants || maxParticipants <= 0) return null
    const taken = session.registrations ? session.registrations.length : 0
    const available = Math.max(0, maxParticipants - taken)
    return { taken, available, max: maxParticipants }
  }

  const handleSlotRegisterToggle = (workshop: Workshop, session: WorkshopSession) => {
    const isRegistered = registeredSlotIds.includes(session.id)
    const userFirstName = user?.firstName || 'Alex'
    const userLastName = user?.lastName || 'Richer'
    const userEmail = user?.email || 'alex.richer@epfl.ch'

    if (isRegistered) {
      unregisterMutation.mutate({ sessionId: session.id, email: userEmail })
      setRegisteredSlotIds((prev) => prev.filter((id) => id !== session.id))
      setToastMessage(`Inscription annulée pour la session de "${workshop.title}"`)
    } else {
      registerMutation.mutate({
        sessionId: session.id,
        firstName: userFirstName,
        lastName: userLastName,
        email: userEmail,
      })
      setRegisteredSlotIds((prev) => Array.from(new Set([...prev, session.id])))
      setToastMessage(`Inscription réussie à "${workshop.title}" !`)
    }
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Filtered Workshops
  const filteredWorkshops = useMemo(() => {
    const now = new Date().getTime()

    return workshops.filter((w) => {
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

      // Time filter
      let matchesTime = true
      if (timeFilter !== 'all') {
        const hasUpcomingSession = w.dates.some((d) => new Date(d.endTime).getTime() > now)
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

  const resetFilters = () => {
    setSearchQuery('')
    setRegistrationFilter('all')
    setTimeFilter('all')
  }

  if (isLoading) {
    return (
      <div className="workshops-connect-container">
        <div className="schedule-header">
          <div className="skeleton skeleton-title"></div>
          <div className="skeleton skeleton-subtitle"></div>
        </div>
        <div className="skeleton-tabs">
          <div className="skeleton skeleton-tab" style={{ width: '120px' }}></div>
          <div className="skeleton skeleton-tab" style={{ width: '120px' }}></div>
        </div>
        <div className="workshops-connect-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton skeleton-card" style={{ height: '220px' }}></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Impossible de charger les ateliers</h3>
        <p>{error.message}</p>
      </div>
    )
  }

  return (
    <div className="workshops-connect-container">
      {/* Notification Toast */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="workshops-connect-header">
        <h1>Ateliers & Workshops</h1>
        <p className="subtitle">Découvrez et participez aux ateliers de la semaine d'intégration</p>
      </div>

      {/* Toolbar & Filters */}
      <div className="workshops-connect-toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher un atelier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              ✕
            </button>
          )}
        </div>

        <div className="filters-row">
          <select
            value={registrationFilter}
            onChange={(e) => setRegistrationFilter(e.target.value as any)}
            className="filter-select-connect"
          >
            <option value="all">Toutes les inscriptions</option>
            <option value="open">🟢 Entrée libre</option>
            <option value="required">📝 Inscription requise</option>
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as any)}
            className="filter-select-connect"
          >
            <option value="all">Toutes les sessions</option>
            <option value="upcoming">⏳ À venir / En cours</option>
            <option value="past">🏁 Passées</option>
          </select>

          {hasActiveFilters && (
            <button className="btn-reset-connect" onClick={resetFilters}>
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Workshops Grid */}
      {filteredWorkshops.length === 0 ? (
        <div className="empty-state-connect">
          <div className="empty-icon">🎨</div>
          {hasActiveFilters ? (
            <>
              <h3>Aucun atelier ne correspond à votre recherche</h3>
              <p>Essayez de modifier vos filtres.</p>
              <button className="btn-primary" onClick={resetFilters}>
                Réinitialiser les filtres
              </button>
            </>
          ) : (
            <>
              <h3>Aucun atelier disponible pour le moment</h3>
              <p>Revenez plus tard pour découvrir le programme des ateliers.</p>
            </>
          )}
        </div>
      ) : (
        <div className="workshops-connect-grid">
          {filteredWorkshops.map((w: Workshop) => {
            const sortedDates = [...(w.dates || [])].sort(
              (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            )

            return (
              <div key={w.id} className="workshop-connect-card">
                <div className="workshop-card-image-wrap">
                  {w.image ? (
                    <img
                      src={w.image}
                      alt={w.title}
                      className="workshop-card-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="workshop-card-placeholder">
                      <span>🎨</span>
                    </div>
                  )}

                  <div className="workshop-badge-container">
                    {w.requiresRegistration ? (
                      <span className="badge-reg required">
                        📝 Inscription {w.maxParticipants ? `(${w.maxParticipants} max/créneau)` : ''}
                      </span>
                    ) : (
                      <span className="badge-reg open">🟢 Entrée libre</span>
                    )}
                  </div>
                </div>

                <div className="workshop-card-body">
                  <h3 className="workshop-card-title">{w.title}</h3>

                  <div className="workshop-card-location">
                    📍 <span>{w.location}</span>
                    <Link
                      to="/map"
                      search={{ places: w.location.split(' ')[0] } as any}
                      className="link-map-inline"
                      title="Voir sur la carte"
                    >
                      🗺️
                    </Link>
                  </div>

                  <p className="workshop-card-desc">{w.description}</p>

                  <div className="workshop-card-slots-section">
                    <span className="slots-label">
                      📅 Créneaux disponibles ({sortedDates.length})
                    </span>
                    <div className="slots-list">
                      {sortedDates.length === 0 ? (
                        <p className="no-slots-text">Aucun créneau défini</p>
                      ) : (
                        sortedDates.map((d, idx) => {
                          const isRegisteredForSlot = registeredSlotIds.includes(d.id)
                          const spotsInfo = getSlotAvailableSpots(d, w.maxParticipants)

                          return (
                            <div
                              key={d.id}
                              className={`slot-option-card ${isRegisteredForSlot ? 'registered' : ''}`}
                            >
                              <div className="slot-info">
                                <div className="slot-time">
                                  <span className="slot-num">Créneau {idx + 1} :</span>
                                  {formatDateTimeRange(d.startTime, d.endTime)}
                                </div>

                                <div className="slot-spots-badge">
                                  {spotsInfo === null ? (
                                    <span className="spots-tag open">🟢 Entrée libre</span>
                                  ) : spotsInfo.available === 0 && !isRegisteredForSlot ? (
                                    <span className="spots-tag full">
                                      🔴 0 / {spotsInfo.max} place(s) (Complet)
                                    </span>
                                  ) : spotsInfo.available <= 3 ? (
                                    <span className="spots-tag low">
                                      🟠 {spotsInfo.available} / {spotsInfo.max} place(s) disponible(s)
                                    </span>
                                  ) : (
                                    <span className="spots-tag available">
                                      🟢 {spotsInfo.available} / {spotsInfo.max} place(s) disponible(s)
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                className={`btn-slot-register ${isRegisteredForSlot ? 'registered' : ''}`}
                                disabled={
                                  spotsInfo !== null &&
                                  spotsInfo.available === 0 &&
                                  !isRegisteredForSlot
                                }
                                onClick={() => handleSlotRegisterToggle(w, d)}
                              >
                                {isRegisteredForSlot ? (
                                  <>
                                    <span className="reg-icon">✓</span>
                                    <span className="reg-status-label">Inscrit(e)</span>
                                    <span className="reg-hover-label">Désinscrire</span>
                                  </>
                                ) : spotsInfo !== null && spotsInfo.available === 0 ? (
                                  <span>Complet</span>
                                ) : (
                                  <>
                                    <span className="reg-icon">✍️</span>
                                    <span>S'inscrire</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}



