import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { trpc } from '../trpc'

export default function Home() {
  const { data: me } = trpc.auth.me.useQuery()
  const { data: slots, isLoading: loadingSlots } = trpc.schedules.list.useQuery()
  const { data: workshops, isLoading: loadingWorkshops } = trpc.workshops.list.useQuery()

  // 1. Logic: If current time is before or on the 1st day (August 26, 2026) before 10:00 AM
  const isFirstDayBefore10 = useMemo(() => {
    const now = new Date()
    // First day cutoff: August 26, 2026 at 10:00 AM
    const cutoff = new Date(2026, 7, 26, 10, 0, 0)
    return now.getTime() < cutoff.getTime()
  }, [])

  // 2. Get today's local date string
  const todayStr = useMemo(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  // 3. Filter today's slots for the user
  const todaySlots = useMemo(() => {
    if (!slots) return []
    const userSectionId = me?.sectionId

    return slots
      .filter((slot) => {
        const slotDate = new Date(slot.startTime)
        const year = slotDate.getFullYear()
        const month = String(slotDate.getMonth() + 1).padStart(2, '0')
        const day = String(slotDate.getDate()).padStart(2, '0')
        const slotDateStr = `${year}-${month}-${day}`

        if (slotDateStr !== todayStr) return false

        if (userSectionId) {
          const slotSectionIds = [
            slot.sectionId,
            ...((slot as any).sections || []).map((s: any) => s.id),
          ].filter(Boolean)

          if (slotSectionIds.length > 0 && !slotSectionIds.includes(userSectionId)) {
            return false
          }
        }
        return true
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [slots, me, todayStr])

  // 4. Find registered workshops
  const registeredSlots = useMemo(() => {
    if (!workshops) return []
    const userEmail = me?.email || ''
    const list: { workshopTitle: string; startTime: string; endTime: string; location: string }[] = []

    workshops.forEach((w) => {
      (w.dates || []).forEach((d) => {
        const isReg = d.registrations?.some((r) => r.email === userEmail)
        if (isReg) {
          list.push({
            workshopTitle: w.title,
            startTime: d.startTime as string,
            endTime: d.endTime as string,
            location: w.location,
          })
        }
      })
    })
    return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [workshops, me])

  const formatTime = (dateInput: Date | string) => {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDayFullLabel = () => {
    const date = new Date()
    const label = date.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })
    return label.replace(/^\w/, (c) => c.toUpperCase())
  }

  // Generate QR Code URL from user ID
  const qrCodeUrl = useMemo(() => {
    if (!me?.id) return ''
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(me.id)}`
  }, [me])

  if (loadingSlots || loadingWorkshops) {
    return (
      <div className="home-container">
        <div className="schedule-header">
          <div className="skeleton skeleton-title"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      {/* Premium Minimal Header */}
      <div className="home-header">
        <h1>Salut, {me?.firstName || 'Étudiant'} !</h1>
        <p className="subtitle">{formatDayFullLabel()}</p>
      </div>

      <div className="home-minimal-layout">
        {/* WELCOME / CHECK-IN ZONE */}
        {isFirstDayBefore10 && (
          <div className="accent-banner-welcome">
            <div className="banner-badge">Semaine de prérentrée S4S</div>
            <h2>Bienvenue à l'EPFL ! 👋</h2>
            
              <div className="welcome-info-pane">
                <p>
                  Toute l'équipe de <strong>Students 4 Students (S4S)</strong> est ravie de t'accueillir ! Retrouve ci-dessous les détails pour ton premier jour d'intégration :
                </p>
                
                <div className="welcome-details-grid">
                  <div className="detail-entry">
                    <span className="label">📅 Date & Heure :</span>
                    <span className="value">26/08/2026 à 08:00</span>
                  </div>
                  <div className="detail-entry">
                    <span className="label">👥 Groupe d'accueil :</span>
                    <span className="value-badge">
                      {me?.firstDayGroup ? `Groupe ${me.firstDayGroup}` : 'Non assigné'}
                    </span>
                  </div>
                  <div className="detail-entry">
                    <span className="label">📍 Rendez-vous :</span>
                    <span className="value">Place Maurice Cosandey</span>
                  </div>
                </div>

                <div className="welcome-note">
                  <strong>💡 Check-in :</strong> Présente ce QR Code lors de ton arrivée pour obtenir ton bracelet.
                </div>
              </div>

              {/* QR Code Container inside the card */}
              {qrCodeUrl && (
                <div className="welcome-qr-pane">
                  <div className="qr-box">
                    <img src={qrCodeUrl} alt="QR Code d'entrée" className="qr-image" />
                  </div>
                </div>
              )}

            <Link 
              to="/map" 
              search={{ places: 'agora' } as any}
              className="banner-action-link"
            >
              🗺️ Voir le lieu de rendez-vous sur le plan de l'application →
            </Link>
          </div>
        )}

        {/* TODAY'S SCHEDULE */}
        <div className="section-block">
          <div className="section-block-header">
            <h3>📅 Programme d'aujourd'hui</h3>
            <Link to="/schedule" className="text-action-link">Voir tout le planning</Link>
          </div>
          
          {todaySlots.length === 0 ? (
            <p className="empty-text-flat">Aucun événement prévu pour aujourd'hui dans ton planning.</p>
          ) : (
            <div className="flat-list-group">
              {todaySlots.map((slot) => {
                const now = new Date()
                const start = new Date(slot.startTime)
                const end = new Date(slot.endTime)
                const isLive = now >= start && now <= end

                return (
                  <div key={slot.id} className={`flat-list-item ${isLive ? 'live' : ''}`}>
                    <div className="flat-item-time">
                      <span>{formatTime(slot.startTime)}</span>
                      <span>{formatTime(slot.endTime)}</span>
                    </div>
                    <div className="flat-item-content">
                      <div className="flat-item-title">
                        {slot.title}
                        {isLive && <span className="live-tag">En cours</span>}
                      </div>
                      {slot.location && (
                        <Link
                          to="/map"
                          search={{ places: slot.location } as any}
                          className="flat-item-meta location-link"
                          style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                          title="Voir sur le plan"
                        >
                          📍 {slot.location}
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* WORKSHOPS */}
        <div className="section-block">
          <div className="section-block-header">
            <h3>🎨 Mes Ateliers Inscrits</h3>
            <Link to="/workshops" className="text-action-link">Découvrir d'autres ateliers</Link>
          </div>

          {registeredSlots.length === 0 ? (
            <p className="empty-text-flat">Tu n'es inscrit à aucun atelier facultatif.</p>
          ) : (
            <div className="flat-list-group">
              {registeredSlots.map((reg, idx) => (
                <div key={idx} className="flat-list-item">
                  <div className="flat-item-time">
                    <span>{formatTime(reg.startTime)}</span>
                    <span>{formatTime(reg.endTime)}</span>
                  </div>
                  <div className="flat-item-content">
                    <div className="flat-item-title">{reg.workshopTitle}</div>
                    <div className="flat-item-meta">
                      <span>📅 {new Date(reg.startTime).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}</span>
                      {reg.location && (
                        <>
                          <span> • </span>
                          <Link
                            to="/map"
                            search={{ places: reg.location } as any}
                            className="location-link"
                            style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                            title="Voir sur le plan"
                          >
                            📍 {reg.location}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SHORTCUTS / ACCÈS RAPIDES */}
        <div className="section-block">
          <h3>🔗 Liens rapides</h3>
          <div className="shortcuts-row">
            <Link to="/map" className="shortcut-btn">🗺️ Plan Interactif</Link>
            <Link to={"/feedback" as any} className="shortcut-btn">💬 Laisser un Avis</Link>
            <a href="https://epfl.ch" target="_blank" rel="noopener noreferrer" className="shortcut-btn">🏫 Site EPFL</a>
          </div>
        </div>
      </div>
    </div>
  )
}
