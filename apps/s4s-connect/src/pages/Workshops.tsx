import { useState, useMemo, useEffect, useCallback } from 'react'
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
  roomId?: string | null
  location?: string | null
  room?: {
    id: string
    name: string
    building?: string | null
  } | null
  registrations?: WorkshopRegistration[]
}

interface Workshop {
  id: string
  title: string
  location: string
  roomId?: string | null
  room?: {
    id: string
    name: string
    building?: string | null
  } | null
  description: string
  image: string | null
  requiresRegistration: boolean
  onlyOneSlotPerUser?: boolean
  isRegistrationClosed?: boolean
  externalRegistrationUrl?: string | null
  maxParticipants: number | null
  dates: WorkshopSession[]
}

import { formatDateTimeRange } from '@s4s/ui'

export default function Workshops() {
  const [searchQuery, setSearchQuery] = useState('')
  const [registrationFilter, setRegistrationFilter] = useState<'all' | 'required' | 'open' | 'favorites'>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null)

  const utils = trpc.useUtils()
  const user = useAuthStore((state) => state.user)

  // Clean up any legacy localStorage cache on mount
  useEffect(() => {
    try {
      localStorage.removeItem('s4s_registered_slots')
      localStorage.removeItem('s4s_registered_workshops')
      localStorage.removeItem('s4s_favorite_workshops')
    } catch {}
  }, [])

  // Fetch workshops with real DB registrations and favorites included
  const { data: workshops = [], isLoading, error } = trpc.workshops.list.useQuery()

  // Derive favorite workshop IDs directly for the current authenticated user from DB
  const favoriteIds = useMemo(() => {
    if (!user) return []
    return workshops
      .filter((w: any) => (w.favorites || []).some((f: any) => f.userId === user.id))
      .map((w: any) => w.id)
  }, [workshops, user])

  // Derive registered slot IDs directly for the current authenticated user
  const registeredSlotIds = useMemo(() => {
    if (!user) return []
    const ids: string[] = []
    const userEmail = user.email?.trim().toLowerCase()
    const userId = user.id

    workshops.forEach((w: any) => {
      (w.dates || []).forEach((d: any) => {
        const isUserReg = (d.registrations || []).some((r: any) => {
          if (userId && r.userId && r.userId === userId) return true
          if (userEmail && r.email && r.email.trim().toLowerCase() === userEmail) return true
          return false
        })
        if (isUserReg) {
          ids.push(d.id)
        }
      })
    })
    return ids
  }, [workshops, user])

  // Keep selected workshop in sync with fresh data
  useEffect(() => {
    if (selectedWorkshop && workshops.length > 0) {
      const fresh = workshops.find((w: any) => w.id === selectedWorkshop.id)
      if (fresh) setSelectedWorkshop(fresh as Workshop)
    }
  }, [workshops])

  // Close on Escape key + scroll lock
  const closeDetail = useCallback(() => setSelectedWorkshop(null), [])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetail() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeDetail])
  useEffect(() => {
    if (selectedWorkshop) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selectedWorkshop])

  // tRPC Mutations
  const registerMutation = trpc.workshops.register.useMutation({
    onSuccess: () => { utils.workshops.list.invalidate() },
    onError: (err) => {
      setToastMessage(err.message || 'Erreur lors de l\'inscription')
      setTimeout(() => setToastMessage(null), 3500)
    },
  })
  const unregisterMutation = trpc.workshops.unregister.useMutation({
    onSuccess: () => { utils.workshops.list.invalidate() },
    onError: (err) => {
      setToastMessage(err.message || 'Erreur lors de la désincription')
      setTimeout(() => setToastMessage(null), 3500)
    },
  })
  const toggleFavoriteMutation = trpc.workshops.toggleFavorite.useMutation({
    onSuccess: () => { utils.workshops.list.invalidate() },
    onError: (err) => {
      setToastMessage(err.message || 'Erreur lors de la mise à jour des favoris')
      setTimeout(() => setToastMessage(null), 3500)
    },
  })

  // Real-time subscription
  trpc.workshops.onUpdated.useSubscription(undefined, {
    onData: () => { utils.workshops.list.invalidate() },
    onError: (err) => { console.error('[DEBUG] Workshops subscription error:', err) },
  })

  const getSlotAvailableSpots = (session: WorkshopSession, maxParticipants: number | null) => {
    if (!maxParticipants || maxParticipants <= 0) return null
    const taken = session.registrations ? session.registrations.length : 0
    const available = Math.max(0, maxParticipants - taken)
    return { taken, available, max: maxParticipants }
  }

  const handleSlotRegisterToggle = (workshop: Workshop, session: WorkshopSession) => {
    if (!user?.email) {
      setToastMessage('Veuillez vous connecter pour vous inscrire à un atelier.')
      setTimeout(() => setToastMessage(null), 3500)
      return
    }

    const isRegistered = registeredSlotIds.includes(session.id)
    const userFirstName = user.firstName || 'Étudiant'
    const userLastName = user.lastName || ''
    const userEmail = user.email.trim()

    if (isRegistered) {
      unregisterMutation.mutate(
        { sessionId: session.id, email: userEmail },
        {
          onSuccess: () => {
            setToastMessage(`Inscription annulée pour "${workshop.title}"`)
            setTimeout(() => setToastMessage(null), 3500)
          },
        }
      )
    } else {
      if (workshop.isRegistrationClosed) {
        setToastMessage('Les inscriptions pour cet atelier sont actuellement closes.')
        setTimeout(() => setToastMessage(null), 3500)
        return
      }

      if (workshop.onlyOneSlotPerUser) {
        const hasOtherReg = (workshop.dates || []).some(
          (d) => d.id !== session.id && registeredSlotIds.includes(d.id)
        )
        if (hasOtherReg) {
          setToastMessage('Vous êtes déjà inscrit(e) à un autre créneau pour cet atelier.')
          setTimeout(() => setToastMessage(null), 3500)
          return
        }
      }

      registerMutation.mutate(
        { sessionId: session.id, firstName: userFirstName, lastName: userLastName, email: userEmail },
        {
          onSuccess: () => {
            setToastMessage(`Inscription réussie à "${workshop.title}" !`)
            setTimeout(() => setToastMessage(null), 3500)
          },
        }
      )
    }
  }

  const toggleFavorite = (workshopId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    if (!user) {
      setToastMessage('Veuillez vous connecter pour enregistrer vos favoris.')
      setTimeout(() => setToastMessage(null), 2500)
      return
    }
    const isFav = favoriteIds.includes(workshopId)
    toggleFavoriteMutation.mutate({ workshopId })
    setToastMessage(isFav ? 'Retiré des favoris' : 'Ajouté aux favoris ❤️')
    setTimeout(() => setToastMessage(null), 2500)
  }

  // Filtered workshops
  const filteredWorkshops = useMemo(() => {
    const now = new Date().getTime()
    return workshops.filter((w) => {
      const matchesSearch =
        !searchQuery ||
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase())
      
      let matchesReg = true
      if (registrationFilter === 'required') {
        matchesReg = w.requiresRegistration
      } else if (registrationFilter === 'open') {
        matchesReg = !w.requiresRegistration
      } else if (registrationFilter === 'favorites') {
        matchesReg = favoriteIds.includes(w.id)
      }

      let matchesTime = true
      if (timeFilter !== 'all') {
        const hasUpcoming = w.dates.some((d) => new Date(d.endTime).getTime() > now)
        matchesTime = timeFilter === 'upcoming' ? hasUpcoming : !hasUpcoming
      }
      return matchesSearch && matchesReg && matchesTime
    })
  }, [workshops, searchQuery, registrationFilter, timeFilter, favoriteIds])

  const hasActiveFilters = searchQuery !== '' || registrationFilter !== 'all' || timeFilter !== 'all'
  const resetFilters = () => { setSearchQuery(''); setRegistrationFilter('all'); setTimeFilter('all') }

  // Split: today vs rest
  const { todayWorkshops, otherWorkshops } = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
    const today: Workshop[] = []
    const other: Workshop[] = []
    filteredWorkshops.forEach((w) => {
      const hasToday = w.dates.some((d) => {
        const s = new Date(d.startTime).getTime()
        const e = new Date(d.endTime).getTime()
        return s < todayEnd.getTime() && e > todayStart.getTime()
      })
      if (hasToday) today.push(w)
      else other.push(w)
    })
    return { todayWorkshops: today, otherWorkshops: other }
  }, [filteredWorkshops])

  // ── Loading ────────────────────────────────────────────────
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
      {/* Toast */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Detail panel (modal on desktop, sheet on mobile) */}
      {selectedWorkshop && (
        <WorkshopDetail
          workshop={selectedWorkshop}
          registeredSlotIds={registeredSlotIds}
          getSlotAvailableSpots={getSlotAvailableSpots}
          onRegisterToggle={handleSlotRegisterToggle}
          onClose={closeDetail}
          favoriteIds={favoriteIds}
          onFavoriteToggle={toggleFavorite}
        />
      )}

      {/* Header */}
      <div className="workshops-connect-header">
        <h1>Workshops</h1>
        <p className="subtitle">Découvrez et participez aux ateliers organisés par les différentes associations de l'EPFL</p>
      </div>

      {/* Toolbar */}
      <div className="workshops-connect-toolbar">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            id="workshops-search"
            type="text"
            placeholder="Rechercher un atelier…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')} aria-label="Effacer">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
        <div className="filters-row">
          <button className={`filter-chip ${registrationFilter === 'all' ? 'active' : ''}`} onClick={() => setRegistrationFilter('all')}>Tous</button>
          <button className={`filter-chip ${registrationFilter === 'open' ? 'active' : ''}`} onClick={() => setRegistrationFilter('open')}>Entrée libre</button>
          <button className={`filter-chip ${registrationFilter === 'required' ? 'active' : ''}`} onClick={() => setRegistrationFilter('required')}>Inscription</button>
          <button className={`filter-chip ${registrationFilter === 'favorites' ? 'active font-rose' : ''}`} onClick={() => setRegistrationFilter('favorites')}>❤️ Favoris</button>
          <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as any)} className="filter-select-connect" style={{ flex: 'none', minWidth: '0', width: 'auto' }}>
            <option value="all">Toutes les sessions</option>
            <option value="upcoming">À venir</option>
            <option value="past">Passées</option>
          </select>
          {hasActiveFilters && <button className="btn-reset-connect" onClick={resetFilters}>Effacer</button>}
          <span className="workshops-results-count">{filteredWorkshops.length} atelier{filteredWorkshops.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Grid */}
      {filteredWorkshops.length === 0 ? (
        <div className="empty-state-connect">
          <div className="empty-icon">🎨</div>
          {hasActiveFilters ? (
            <>
              <h3>Aucun atelier ne correspond à votre recherche</h3>
              <p>Essayez de modifier vos filtres.</p>
              <button className="btn-primary" onClick={resetFilters}>Réinitialiser les filtres</button>
            </>
          ) : (
            <>
              <h3>Aucun atelier disponible pour le moment</h3>
              <p>Revenez plus tard pour découvrir le programme des ateliers.</p>
            </>
          )}
        </div>
      ) : (
        <>
          {todayWorkshops.length > 0 && (
            <>
              <div className="workshops-section-label">
                <h2>Aujourd'hui</h2>
                <span className="today-badge">En cours</span>
              </div>
              <div className="workshops-connect-grid">
                {todayWorkshops.map((w) => (
                  <WorkshopCard
                    key={w.id}
                    workshop={w}
                    registeredSlotIds={registeredSlotIds}
                    getSlotAvailableSpots={getSlotAvailableSpots}
                    onRegisterToggle={handleSlotRegisterToggle}
                    onClick={() => setSelectedWorkshop(w)}
                    isFavorite={favoriteIds.includes(w.id)}
                    onFavoriteToggle={(e) => toggleFavorite(w.id, e)}
                  />
                ))}
              </div>
            </>
          )}
          {otherWorkshops.length > 0 && (
            <>
              {todayWorkshops.length > 0 && (
                <>
                  <hr className="workshops-section-divider" />
                  <div className="workshops-section-label">
                    <h2>Autres ateliers</h2>
                  </div>
                </>
              )}
              <div className="workshops-connect-grid">
                {otherWorkshops.map((w) => (
                  <WorkshopCard
                    key={w.id}
                    workshop={w}
                    registeredSlotIds={registeredSlotIds}
                    getSlotAvailableSpots={getSlotAvailableSpots}
                    onRegisterToggle={handleSlotRegisterToggle}
                    onClick={() => setSelectedWorkshop(w)}
                    isFavorite={favoriteIds.includes(w.id)}
                    onFavoriteToggle={(e) => toggleFavorite(w.id, e)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── Workshop Card ──────────────────────────────────────────────
interface CardProps {
  workshop: Workshop
  registeredSlotIds: string[]
  getSlotAvailableSpots: (s: WorkshopSession, max: number | null) => { taken: number; available: number; max: number } | null
  onRegisterToggle: (w: Workshop, s: WorkshopSession) => void
  onClick: () => void
  isFavorite: boolean
  onFavoriteToggle: (e: React.MouseEvent) => void
}

function WorkshopCard({ workshop: w, registeredSlotIds, getSlotAvailableSpots, onRegisterToggle, onClick, isFavorite, onFavoriteToggle }: CardProps) {
  const now = Date.now()
  const sortedDates = [...(w.dates || [])]
    .sort((a, b) => {
      const aIsPast = new Date(a.endTime).getTime() < now
      const bIsPast = new Date(b.endTime).getTime() < now
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1  // upcoming first
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })
  const displayedDates = sortedDates.slice(0, 3)
  const hiddenCount = sortedDates.length - displayedDates.length

  const hasWorkshopReg = useMemo(() => {
    return (w.dates || []).some((d) => registeredSlotIds.includes(d.id))
  }, [w.dates, registeredSlotIds])

  return (
    <div className="workshop-connect-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="workshop-card-image-wrap">
        {w.image ? (
          <img src={w.image} alt={w.title} className="workshop-card-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="workshop-card-placeholder"><span>🎨</span></div>
        )}
        <div className="workshop-badge-container">
          {w.isRegistrationClosed ? (
            <span className="badge-reg required" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.5)' }}>
              🔒 Inscriptions closes
            </span>
          ) : w.requiresRegistration ? (
            w.externalRegistrationUrl ? (
              <span className="badge-reg external">🔗 Formulaire externe</span>
            ) : (
              <span className="badge-reg required">Inscription requise{w.maxParticipants ? ` · ${w.maxParticipants} max` : ''}</span>
            )
          ) : (
            <span className="badge-reg open">Entrée libre</span>
          )}
          {w.requiresRegistration && w.onlyOneSlotPerUser && !w.isRegistrationClosed && (
            <span className="badge-reg" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.4)' }}>
              1 créneau max
            </span>
          )}
          {/* Favorite button absolute over image */}
          <button className={`workshop-fav-btn ${isFavorite ? 'active' : ''}`} onClick={onFavoriteToggle} aria-label="Ajouter aux favoris">
            {isFavorite ? '❤️' : '🤍'}
          </button>
        </div>
      </div>

      <div className="workshop-card-body">
        <h3 className="workshop-card-title">{w.title}</h3>
        <Link
          to="/map"
          search={{ places: w.location } as any}
          className="workshop-card-location location-link"
          style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
          title="Voir sur le plan"
          onClick={(e) => e.stopPropagation()}
        >
          <span>📍</span>
          <span>{w.location}</span>
        </Link>
        <p className="workshop-card-desc">{w.description}</p>

        <div className="workshop-card-slots-section">
          <span className="slots-label">{sortedDates.length} créneau{sortedDates.length !== 1 ? 'x' : ''}</span>
          <div className="slots-list">
            {displayedDates.length === 0 ? (
              <p className="no-slots-text">Aucun créneau défini</p>
            ) : (
              <>
                {displayedDates.map((d, idx) => {
                const isReg = registeredSlotIds.includes(d.id)
                const spots = getSlotAvailableSpots(d, w.maxParticipants)
                const isPast = new Date(d.endTime).getTime() < Date.now()
                const isClosed = Boolean(w.isRegistrationClosed)
                const isBlockedByOtherSlot = !isReg && Boolean(w.onlyOneSlotPerUser) && hasWorkshopReg

                const isDisabled = isPast || (isClosed && !isReg) || isBlockedByOtherSlot || (spots !== null && spots.available === 0 && !isReg)

                return (
                  <div key={d.id} className={`slot-option-card ${isReg ? 'registered' : ''} ${isPast ? 'past' : ''}`} onClick={(e) => e.stopPropagation()}>
                    <div className="slot-info">
                      <div className="slot-time">
                        <span className="slot-num">#{idx + 1}</span>
                        {formatDateTimeRange(d.startTime, d.endTime)}
                      </div>
                      <div className="slot-spots-badge">
                        {isPast ? (
                          <span className="spots-tag past">Terminé</span>
                        ) : isClosed ? (
                          <span className="spots-tag full" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>Clôturé</span>
                        ) : w.externalRegistrationUrl ? (
                          <span className="spots-tag open" style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa' }}>Lien externe</span>
                        ) : spots === null ? (
                          <span className="spots-tag open">Entrée libre</span>
                        ) : spots.available === 0 && !isReg ? (
                          <span className="spots-tag full">Complet · {spots.max} places</span>
                        ) : spots.available <= 3 ? (
                          <span className="spots-tag low">{spots.available}/{spots.max} places</span>
                        ) : (
                          <span className="spots-tag available">{spots.available}/{spots.max} places</span>
                        )}
                      </div>
                    </div>
                    {w.externalRegistrationUrl ? (
                      <a
                        href={w.externalRegistrationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-slot-register external-link-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Formulaire ↗</span>
                      </a>
                    ) : (
                      <button
                        className={`btn-slot-register ${isReg ? 'registered' : ''}`}
                        disabled={isDisabled}
                        title={
                          isPast
                            ? 'Créneau terminé'
                            : isClosed && !isReg
                            ? 'Inscriptions closes'
                            : isBlockedByOtherSlot
                            ? 'Vous êtes déjà inscrit(e) à un autre créneau'
                            : spots !== null && spots.available === 0 && !isReg
                            ? 'Complet'
                            : undefined
                        }
                        onClick={(e) => { e.stopPropagation(); onRegisterToggle(w, d) }}
                      >
                        {isPast ? (
                          <span>Terminé</span>
                        ) : isReg ? (
                          <><span className="reg-icon">✓</span><span className="reg-status-label">Inscrit(e)</span><span className="reg-hover-label">Désinscrire</span></>
                        ) : isClosed ? (
                          <span>Clos</span>
                        ) : isBlockedByOtherSlot ? (
                          <span>Déjà inscrit</span>
                        ) : spots !== null && spots.available === 0 ? (
                          <span>Complet</span>
                        ) : (
                          <><span className="reg-icon">+</span><span>S'inscrire</span></>
                        )}
                      </button>
                    )}
                  </div>
                )
                })}
                {hiddenCount > 0 && (
                  <p className="slots-more-hint" onClick={(e) => { e.stopPropagation(); onClick() }}>
                    +{hiddenCount} autre{hiddenCount > 1 ? 's' : ''} — voir le détail
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Workshop Detail Panel ──────────────────────────────────────
interface DetailProps {
  workshop: Workshop
  registeredSlotIds: string[]
  getSlotAvailableSpots: (s: WorkshopSession, max: number | null) => { taken: number; available: number; max: number } | null
  onRegisterToggle: (w: Workshop, s: WorkshopSession) => void
  onClose: () => void
  favoriteIds: string[]
  onFavoriteToggle: (id: string, e?: React.MouseEvent) => void
}

function WorkshopDetail({ workshop: w, registeredSlotIds, getSlotAvailableSpots, onRegisterToggle, onClose, favoriteIds, onFavoriteToggle }: DetailProps) {
  const now = Date.now()
  const sortedDates = [...(w.dates || [])]
    .sort((a, b) => {
      const aIsPast = new Date(a.endTime).getTime() < now
      const bIsPast = new Date(b.endTime).getTime() < now
      if (aIsPast !== bIsPast) return aIsPast ? 1 : -1
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    })

  const isFavorite = favoriteIds.includes(w.id)
  const hasWorkshopReg = useMemo(() => {
    return (w.dates || []).some((d) => registeredSlotIds.includes(d.id))
  }, [w.dates, registeredSlotIds])

  return (
    <div className="workshop-detail-overlay" onClick={onClose}>
      <div className="workshop-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Image header */}
        <div className="detail-image-wrap">
          {w.image ? (
            <img src={w.image} alt={w.title} className="detail-img" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <div className="detail-img-placeholder"><span>🎨</span></div>
          )}
          <div className="detail-image-gradient" />
          <button className="detail-close-btn" onClick={onClose} aria-label="Fermer">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          {/* Favorite button absolute over detail image */}
          <button className={`detail-fav-btn ${isFavorite ? 'active' : ''}`} onClick={(e) => onFavoriteToggle(w.id, e)} aria-label="Ajouter aux favoris">
            {isFavorite ? '❤️' : '🤍'}
          </button>

          <div className="detail-header-content">
            {w.isRegistrationClosed ? (
              <span className="badge-reg required" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.5)' }}>
                🔒 Inscriptions closes
              </span>
            ) : w.requiresRegistration ? (
              w.externalRegistrationUrl ? (
                <span className="badge-reg external">🔗 Formulaire externe</span>
              ) : (
                <span className="badge-reg required">Inscription requise{w.maxParticipants ? ` · ${w.maxParticipants} max` : ''}</span>
              )
            ) : (
              <span className="badge-reg open">Entrée libre</span>
            )}
            {w.requiresRegistration && w.onlyOneSlotPerUser && !w.isRegistrationClosed && (
              <span className="badge-reg" style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.4)' }}>
                1 créneau max par participant
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="detail-body">
          <h2 className="detail-title">{w.title}</h2>

          <div className="detail-location-row">
            <span className="detail-location-icon">📍</span>
            <span className="detail-location-text">{w.location}</span>
            <Link
              to="/map"
              search={{ places: w.location } as any}
              className="detail-map-link"
              onClick={onClose}
            >
              Voir sur la carte →
            </Link>
          </div>

          <p className="detail-description">{w.description}</p>

          {/* Registration closed banner */}
          {w.isRegistrationClosed && (
            <div style={{ margin: '1rem 0', padding: '0.9rem 1.1rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔒</span>
              <div style={{ fontSize: '0.86rem', color: '#fca5a5' }}>
                <strong>Inscriptions closes :</strong> Les inscriptions pour cet atelier ne sont plus acceptées pour le moment.
              </div>
            </div>
          )}

          {/* 1-slot limit banner */}
          {!w.isRegistrationClosed && w.requiresRegistration && w.onlyOneSlotPerUser && (
            <div style={{ margin: '0.75rem 0', padding: '0.75rem 1rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1rem' }}>ℹ️</span>
              <div style={{ fontSize: '0.82rem', color: '#d8b4fe' }}>
                Cet atelier est limité à <strong>1 seul créneau</strong> par étudiant afin de permettre à un maximum de personnes d'y participer.
              </div>
            </div>
          )}

          {/* External registration banner */}
          {w.externalRegistrationUrl && (
            <div style={{ margin: '1rem 0', padding: '0.9rem 1.1rem', background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.35)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.86rem', color: '#ffffff' }}>
                <strong>📝 Formulaire externe d'inscription :</strong> Les inscriptions pour cet atelier sont gérées via un formulaire en ligne.
              </div>
              <a
                href={w.externalRegistrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-slot-register external-link-btn"
                style={{ padding: '0.5rem 1rem', fontSize: '0.82rem' }}
              >
                <span>Remplir le formulaire ↗</span>
              </a>
            </div>
          )}

          <div className="detail-slots-section">
            <h3 className="detail-slots-title">
              {sortedDates.length} créneau{sortedDates.length !== 1 ? 'x' : ''} disponible{sortedDates.length !== 1 ? 's' : ''}
            </h3>
            <div className="detail-slots-list">
              {sortedDates.length === 0 ? (
                <p className="no-slots-text">Aucun créneau défini</p>
              ) : (
                sortedDates.map((d, idx) => {
                  const isReg = registeredSlotIds.includes(d.id)
                  const spots = getSlotAvailableSpots(d, w.maxParticipants)
                  const isPast = new Date(d.endTime).getTime() < Date.now()
                  const isClosed = Boolean(w.isRegistrationClosed)
                  const isBlockedByOtherSlot = !isReg && Boolean(w.onlyOneSlotPerUser) && hasWorkshopReg

                  const isDisabled = isPast || (isClosed && !isReg) || isBlockedByOtherSlot || (spots !== null && spots.available === 0 && !isReg)

                  return (
                    <div key={d.id} className={`detail-slot-card ${isReg ? 'registered' : ''} ${isPast ? 'past' : ''}`}>
                      <div className="detail-slot-header">
                        <span className="detail-slot-num">Créneau {idx + 1}</span>
                        {isPast ? (
                          <span className="spots-tag past">Terminé</span>
                        ) : isClosed ? (
                          <span className="spots-tag full" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>Clôturé</span>
                        ) : w.externalRegistrationUrl ? (
                          <span className="spots-tag open" style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#60a5fa' }}>Lien externe</span>
                        ) : spots === null ? (
                          <span className="spots-tag open">Entrée libre</span>
                        ) : spots.available === 0 && !isReg ? (
                          <span className="spots-tag full">Complet</span>
                        ) : spots.available <= 3 ? (
                          <span className="spots-tag low">{spots.available}/{spots.max} places</span>
                        ) : (
                          <span className="spots-tag available">{spots.available}/{spots.max} places</span>
                        )}
                      </div>
                      <div className="detail-slot-time">
                        {formatDateTimeRange(d.startTime, d.endTime)}
                        {(d.room?.name || d.location) && (d.room?.name || d.location) !== (w.room?.name || w.location) && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', opacity: 0.85 }}>
                            📍 {d.room?.name || d.location}
                          </span>
                        )}
                      </div>
                      {w.requiresRegistration && (
                        w.externalRegistrationUrl ? (
                          <a
                            href={w.externalRegistrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="detail-slot-btn external-link-btn"
                            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                          >
                            <span>S'inscrire (Formulaire externe) ↗</span>
                          </a>
                        ) : (
                          <button
                            className={`detail-slot-btn ${isReg ? 'registered' : ''}`}
                            disabled={isDisabled}
                            onClick={() => onRegisterToggle(w, d)}
                          >
                            {isPast ? (
                              <span>Créneau terminé</span>
                            ) : isReg ? (
                              <><span>✓ Inscrit(e)</span><span className="detail-slot-btn-hover">Annuler l'inscription</span></>
                            ) : isClosed ? (
                              <span>Inscriptions closes</span>
                            ) : isBlockedByOtherSlot ? (
                              <span>Déjà inscrit(e) à un créneau</span>
                            ) : spots !== null && spots.available === 0 ? (
                              <span>Complet</span>
                            ) : (
                              <span>+ S'inscrire à ce créneau</span>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
