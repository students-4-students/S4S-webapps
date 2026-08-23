import { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  createSwissCrs,
  createPlanPanes,
  createBackgroundLayers,
  createRoomLabels,
  EPFL_BUILDING_COORDS,
  EPFL_CENTER,
  EPFL_INITIAL_ZOOM,
  type RoomLabelsController,
} from '../lib/epflMap'
import { trpc } from '../trpc'

const ZOOM_THRESHOLD_FOR_ROOMS = 24

function inferBuildingAndFloor(roomNameStr: string, explicitBuilding?: string | null, explicitFloor?: number | null) {
  const clean = roomNameStr.replace(/\s+/g, '').toUpperCase()

  let buildingCode = explicitBuilding?.trim().toUpperCase() || ''
  if (!buildingCode) {
    const matchBldg = clean.match(/^([A-Z]{2,4})/)
    if (matchBldg) buildingCode = matchBldg[1]
  }

  let floorNum = explicitFloor ?? null
  if (floorNum === null) {
    const matchNum = clean.match(/^[A-Z]{2,4}(\d)/)
    if (matchNum && matchNum[1]) {
      const parsed = parseInt(matchNum[1], 10)
      if (!isNaN(parsed) && parsed >= -1 && parsed <= 6) {
        floorNum = parsed
      }
    }
  }

  const bldgObj = EPFL_BUILDING_COORDS[buildingCode]

  return {
    buildingCode,
    floorNum: floorNum ?? bldgObj?.defaultFloor ?? 0,
    latitude: bldgObj?.latitude ?? EPFL_CENTER[0],
    longitude: bldgObj?.longitude ?? EPFL_CENTER[1],
  }
}

function normalizeRoomKey(str: string): string {
  if (!str) return ''
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function extractRoomTokens(str: string): string[] {
  if (!str) return []
  return str
    .split(/[,;/+&]+|\bet\b|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

function roomMatchesTokenExact(room: { name: string; building: string }, token: string): boolean {
  if (!token) return false
  const normToken = normalizeRoomKey(token)
  if (!normToken) return false

  const normName = normalizeRoomKey(room.name)
  const normNameNoSalle = normalizeRoomKey(room.name.replace(/^salle\s*/i, ''))
  const normTokenNoSalle = normalizeRoomKey(token.replace(/^salle\s*/i, ''))

  // 1. Exact match on normalized room name
  if (normName === normToken || normNameNoSalle === normTokenNoSalle) {
    return true
  }

  // 2. Exact match on building code ONLY if token is pure letters matching the building
  const normBldg = normalizeRoomKey(room.building)
  if (/^[a-z]+$/.test(normToken) && normBldg === normToken) {
    return true
  }

  return false
}

function roomMatchesTokens(room: { name: string; building: string }, tokens: string[], isExact: boolean = true): boolean {
  if (tokens.length === 0) return false
  if (isExact) {
    return tokens.some((tok) => roomMatchesTokenExact(room, tok))
  }
  const normName = normalizeRoomKey(room.name)
  const normBldg = normalizeRoomKey(room.building)
  return tokens.some((tok) => {
    const normTok = normalizeRoomKey(tok)
    if (!normTok) return false
    return (
      normName === normTok ||
      normName.includes(normTok) ||
      normBldg === normTok ||
      normBldg.includes(normTok)
    )
  })
}

export default function MapPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const roomLabelsCtrlRef = useRef<RoomLabelsController | null>(null)
  const bgLayersRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: L.Marker }>({})

  const [currentFloor, setCurrentFloor] = useState<number>(0)
  const [zoomLevel, setZoomLevel] = useState<number>(EPFL_INITIAL_ZOOM)
  const [mapLoaded, setMapLoaded] = useState<boolean>(false)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isMultiRoomCardDismissed, setIsMultiRoomCardDismissed] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768
  })

  // Parse room query parameter from URL (e.g. ?places=BC410, CO 1 or ?room=BC410)
  const urlParamRoom = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const val = params.get('places') || params.get('place') || params.get('room') || params.get('rooms')
    return val ? val.trim() : ''
  }, [location.search])

  // Re-evaluate dismissed state when search/URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMultiRoomCardDismissed(window.innerWidth < 768)
    }
  }, [urlParamRoom, searchQuery])

  // Fetch rooms from Database
  const { data: dbRooms = [] } = trpc.rooms.list.useQuery()

  // Rooms list derived solely from Database
  const displayRooms = useMemo(() => {
    return dbRooms.map((r) => {
      const info = inferBuildingAndFloor(r.name, r.building, r.floor)
      return {
        id: r.id,
        name: r.name,
        building: info.buildingCode || r.building || 'EPFL',
        floor: typeof r.floor === 'number' ? r.floor : info.floorNum,
        isComputerRoom: Boolean(r.isComputerRoom),
        latitude: typeof r.latitude === 'number' && !isNaN(r.latitude) ? r.latitude : info.latitude,
        longitude: typeof r.longitude === 'number' && !isNaN(r.longitude) ? r.longitude : info.longitude,
      }
    })
  }, [dbRooms])

  // Active query tokens for multi-room search & highlighting
  const activeQueryTokens = useMemo(() => {
    const raw = searchQuery || urlParamRoom
    return extractRoomTokens(raw)
  }, [searchQuery, urlParamRoom])

  // Matched rooms from active tokens (URL or search)
  const matchedRooms = useMemo(() => {
    if (activeQueryTokens.length === 0) return []
    const matched = displayRooms.filter((r) => roomMatchesTokens(r, activeQueryTokens, true))

    // If a token from URL did not match any predefined room, synthesize a virtual room point
    if (urlParamRoom) {
      const urlTokens = extractRoomTokens(urlParamRoom)
      const unmatchedTokens = urlTokens.filter(
        (tok) => !matched.some((r) => roomMatchesTokenExact(r, tok))
      )
      unmatchedTokens.forEach((tok, idx) => {
        const info = inferBuildingAndFloor(tok)
        matched.push({
          id: `synth-${normalizeRoomKey(tok)}-${idx}`,
          name: tok.trim().toUpperCase(),
          building: info.buildingCode || 'EPFL',
          floor: info.floorNum,
          isComputerRoom: false,
          latitude: info.latitude,
          longitude: info.longitude,
        })
      })
    }

    return matched
  }, [activeQueryTokens, displayRooms, urlParamRoom])

  // Set of selected room IDs for O(1) lookup
  const selectedRoomIds = useMemo(() => {
    return new Set(matchedRooms.map((r) => r.id))
  }, [matchedRooms])

  // Floors containing matched rooms
  const matchedFloors = useMemo(() => {
    const floors = new Set<number>()
    matchedRooms.forEach((r) => floors.add(r.floor))
    return Array.from(floors).sort((a, b) => a - b)
  }, [matchedRooms])

  // Rooms on currently viewed floor
  const floorRooms = useMemo(() => {
    return displayRooms.filter((r) => r.floor === currentFloor)
  }, [displayRooms, currentFloor])

  // Filtered rooms in sidebar
  const filteredRooms = useMemo(() => {
    if (activeQueryTokens.length === 0) return floorRooms
    return matchedRooms.length > 0 ? matchedRooms : displayRooms.filter((r) => roomMatchesTokens(r, activeQueryTokens))
  }, [displayRooms, floorRooms, matchedRooms, activeQueryTokens])

  // Active selected room object
  const activeRoom = useMemo(() => {
    if (activeRoomId) {
      return displayRooms.find((r) => r.id === activeRoomId) || matchedRooms.find((r) => r.id === activeRoomId) || null
    }
    return matchedRooms[0] || null
  }, [displayRooms, matchedRooms, activeRoomId])

  // Initialize EPFL Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const crs = createSwissCrs()

    const map = L.map(mapContainerRef.current, {
      crs,
      center: EPFL_CENTER,
      zoom: EPFL_INITIAL_ZOOM,
      minZoom: 16,
      maxZoom: 31,
      zoomControl: false,
    })

    createPlanPanes(map)
    L.control.zoom({ position: 'topright' }).addTo(map)

    const bgLayers = createBackgroundLayers(currentFloor)
    bgLayersRef.current = bgLayers

    bgLayers.osm.addTo(map)
    bgLayers.buildings.addTo(map)

    const roomLabels = createRoomLabels(map, { floor: currentFloor, enabled: true })
    roomLabelsCtrlRef.current = roomLabels

    const onZoom = () => {
      setZoomLevel(map.getZoom())
    }
    map.on('zoomend', onZoom)

    mapInstanceRef.current = map
    setMapLoaded(true)

    return () => {
      map.off('zoomend', onZoom)
      roomLabels.destroy()
      map.remove()
    }
  }, [])

  // Update background and labels when floor changes
  useEffect(() => {
    if (!mapInstanceRef.current || !bgLayersRef.current) return
    const map = mapInstanceRef.current

    map.removeLayer(bgLayersRef.current.buildings)
    const newLayers = createBackgroundLayers(currentFloor)
    bgLayersRef.current.buildings = newLayers.buildings
    newLayers.buildings.addTo(map)

    if (!map.hasLayer(bgLayersRef.current.osm)) {
      bgLayersRef.current.osm.addTo(map)
    }

    if (roomLabelsCtrlRef.current) {
      roomLabelsCtrlRef.current.setFloor(currentFloor)
    }
  }, [currentFloor])

  // Auto-focus and zoom when URL rooms change or map loads
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || matchedRooms.length === 0) return

    const map = mapInstanceRef.current

    // Set initial active room and floor
    const first = matchedRooms[0]
    setActiveRoomId(first.id)
    setCurrentFloor(first.floor)

    if (matchedRooms.length === 1) {
      map.flyTo([first.latitude, first.longitude], 29, { duration: 1 })
    } else {
      // Multiple rooms: compute bounding box and fit bounds so all rooms are visible
      const latLngs: L.LatLngTuple[] = matchedRooms.map((r) => [r.latitude, r.longitude])
      const bounds = L.latLngBounds(latLngs)
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 28 })
    }
  }, [mapLoaded, urlParamRoom, matchedRooms.length])

  // Render Leaflet Markers on Map for the current floor
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    const map = mapInstanceRef.current

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m))
    markersRef.current = {}

    const isZoomedIn = zoomLevel >= ZOOM_THRESHOLD_FOR_ROOMS

    // Get rooms to display on current floor + any synthesized matched rooms on this floor
    const allCurrentFloorRooms = [
      ...floorRooms,
      ...matchedRooms.filter((r) => r.floor === currentFloor && !floorRooms.some((fr) => fr.id === r.id)),
    ]

    if (isZoomedIn || matchedRooms.length > 0) {
      // Zoomed in OR active selection: show room badges
      allCurrentFloorRooms.forEach((room) => {
        const isMatched = selectedRoomIds.has(room.id) || roomMatchesTokens(room, activeQueryTokens)
        const isActive = activeRoom?.id === room.id

        // Show marker if zoomed in or if it's one of the matched rooms
        if (!isZoomedIn && !isMatched) return

        const iconHtml = `
          <div class="epfl-map-marker ${isMatched ? 'is-green-highlighted' : ''} ${isActive ? 'is-active-focused' : ''}">
            <div class="epfl-marker-badge">${room.isComputerRoom ? '🖥️ ' : ''}${room.name}</div>
          </div>
        `

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'epfl-leaflet-marker-container',
          iconSize: [70, 40],
          iconAnchor: [35, 20],
        })

        const marker = L.marker([room.latitude, room.longitude], {
          icon: customIcon,
          zIndexOffset: isMatched ? 1000 : 0,
        }).addTo(map)

        marker.on('click', () => {
          setActiveRoomId(room.id)
          setCurrentFloor(room.floor)
          map.flyTo([room.latitude, room.longitude], 29, { duration: 0.8 })
        })

        markersRef.current[room.id] = marker
      })
    } else {
      // Zoomed out without active filter: cluster by building
      const groupedByBuilding: Record<string, { lat: number; lng: number; rooms: typeof floorRooms }> = {}

      floorRooms.forEach((room) => {
        const bCode = room.building || 'EPFL'
        if (!groupedByBuilding[bCode]) {
          groupedByBuilding[bCode] = { lat: room.latitude, lng: room.longitude, rooms: [] }
        }
        groupedByBuilding[bCode].rooms.push(room)
      })

      Object.entries(groupedByBuilding).forEach(([bCode, group]) => {
        const iconHtml = `
          <div class="epfl-map-marker">
            <div class="epfl-marker-badge" style="font-size: 0.88rem; padding: 0.4rem 0.75rem;">${bCode}</div>
          </div>
        `

        const customIcon = L.divIcon({
          html: iconHtml,
          className: 'epfl-leaflet-marker-container',
          iconSize: [50, 36],
          iconAnchor: [25, 18],
        })

        const marker = L.marker([group.lat, group.lng], {
          icon: customIcon,
        }).addTo(map)

        marker.on('click', () => {
          const firstRoom = group.rooms[0]
          if (firstRoom) {
            setActiveRoomId(firstRoom.id)
          }
          map.flyTo([group.lat, group.lng], 29, { duration: 0.8 })
        })

        markersRef.current[bCode] = marker
      })
    }
  }, [mapLoaded, floorRooms, matchedRooms, selectedRoomIds, activeQueryTokens, activeRoom, zoomLevel, currentFloor])

  const handleSelectRoom = (room: { id: string; name: string; building: string; floor: number; latitude: number; longitude: number }) => {
    setActiveRoomId(room.id)
    setCurrentFloor(room.floor)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([room.latitude, room.longitude], 29, { duration: 0.8 })
    }
  }

  const handleClearUrlFilters = () => {
    navigate({ to: '/map', search: {} } as any)
    setSearchQuery('')
    setActiveRoomId(null)
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(EPFL_CENTER, EPFL_INITIAL_ZOOM, { duration: 0.8 })
    }
  }

  return (
    <div className="map-page-container" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar Controls */}
      <div className="map-sidebar">
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--s4s-border)' }}>
          <div className="map-search-box">
            <input
              type="text"
              className="s4s-input"
              placeholder="Rechercher une salle (ex: BC 01, CO 1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {urlParamRoom && (
          <div style={{ padding: '0.6rem 1rem', background: '#ecfdf5', borderBottom: '1px solid #a7f3d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#065f46' }}>
            <span>
              🎯 Salles du cours : <strong>{urlParamRoom}</strong> ({matchedRooms.length} trouvée{matchedRooms.length !== 1 ? 's' : ''})
            </span>
            <button
              type="button"
              onClick={handleClearUrlFilters}
              style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: 700, padding: '0.2rem 0.4rem' }}
            >
              Effacer
            </button>
          </div>
        )}

        {/* Database / Matched Rooms List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filteredRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.82rem', color: 'var(--s4s-text-muted)' }}>
              Aucune salle trouvée
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isSelected = activeRoom?.id === room.id
              const isGreenMatch = selectedRoomIds.has(room.id) || (activeQueryTokens.length > 0 && roomMatchesTokens(room, activeQueryTokens, true))

              return (
                <div
                  key={room.id}
                  onClick={() => handleSelectRoom(room)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--s4s-radius-md)',
                    background: isGreenMatch ? '#ecfdf5' : isSelected ? '#eff6ff' : 'var(--s4s-bg-subtle)',
                    border: isSelected ? '2px solid #2563eb' : isGreenMatch ? '2px solid #10b981' : '1px solid var(--s4s-border)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isGreenMatch ? '#047857' : isSelected ? '#2563eb' : 'var(--s4s-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span>{room.name}</span>
                      {room.isComputerRoom && (
                        <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
                          🖥️ Ordi
                        </span>
                      )}
                      {isGreenMatch && <span style={{ fontSize: '0.72rem', background: '#10b981', color: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>Cours</span>}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--s4s-text-muted)', marginTop: '0.15rem' }}>
                      Bâtiment <strong>{room.building}</strong> — Étage <strong>{room.floor}</strong>
                    </div>
                  </div>
                  {room.floor !== currentFloor && (
                    <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>
                      Aller à l'étage {room.floor} →
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main EPFL Leaflet Map Container */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Floating Floor Selector Widget on Map */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '24px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            border: '1px solid var(--s4s-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'hidden',
            zIndex: 1000,
            width: '58px',
          }}
        >
          {/* Up Arrow */}
          <button
            type="button"
            onClick={() => setCurrentFloor((prev) => Math.min(4, prev + 1))}
            disabled={currentFloor >= 4}
            title="Étage supérieur"
            style={{
              width: '100%',
              height: '36px',
              border: 'none',
              background: 'transparent',
              color: currentFloor >= 4 ? '#cbd5e1' : '#1e293b',
              fontSize: '1rem',
              cursor: currentFloor >= 4 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid var(--s4s-border)',
              transition: 'all 120ms ease',
            }}
          >
            ▲
          </button>

          {/* Current Floor Display */}
          <div
            style={{
              padding: '0.4rem 0',
              width: '100%',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: matchedFloors.includes(currentFloor) ? '#ecfdf5' : '#f8fafc',
            }}
          >
            <span style={{ fontSize: '0.58rem', fontWeight: 800, color: matchedFloors.includes(currentFloor) ? '#047857' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Étage
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: matchedFloors.includes(currentFloor) ? '#047857' : '#0f172a', lineHeight: 1.1 }}>
              {currentFloor}
            </span>
            {matchedFloors.includes(currentFloor) && (
              <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 800 }}>● Actif</span>
            )}
          </div>

          {/* Down Arrow */}
          <button
            type="button"
            onClick={() => setCurrentFloor((prev) => Math.max(0, prev - 1))}
            disabled={currentFloor <= 0}
            title="Étage inférieur"
            style={{
              width: '100%',
              height: '36px',
              border: 'none',
              background: 'transparent',
              color: currentFloor <= 0 ? '#cbd5e1' : '#1e293b',
              fontSize: '1rem',
              cursor: currentFloor <= 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderTop: '1px solid var(--s4s-border)',
              transition: 'all 120ms ease',
            }}
          >
            ▼
          </button>
        </div>

        {/* Multi-Room or Single Room Overlay Card on Map */}
        {matchedRooms.length > 1 ? (
          !isMultiRoomCardDismissed ? (
            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '94px',
                right: '24px',
                maxWidth: '480px',
                background: 'rgba(255, 255, 255, 0.96)',
                backdropFilter: 'blur(12px)',
                padding: '1rem',
                borderRadius: 'var(--s4s-radius-lg)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
                border: '2px solid #10b981',
                zIndex: 1000,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>📍</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                    Salles du cours ({matchedRooms.length} salles sélectionnées)
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMultiRoomCardDismissed(true)}
                  title="Fermer la fenêtre (les salles restent sélectionnées sur le plan)"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.3rem',
                    cursor: 'pointer',
                    color: 'var(--s4s-text-muted)',
                    lineHeight: 1,
                    padding: '0.1rem 0.3rem',
                  }}
                >
                  &times;
                </button>
              </div>

              {/* List of room pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto' }}>
                {matchedRooms.map((room) => {
                  const isActive = activeRoom?.id === room.id
                  const isCurrentFloor = room.floor === currentFloor

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => handleSelectRoom(room)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.75rem',
                        borderRadius: '8px',
                        border: isActive ? '2px solid #2563eb' : isCurrentFloor ? '2px solid #10b981' : '1px solid #cbd5e1',
                        background: isActive ? '#eff6ff' : isCurrentFloor ? '#ecfdf5' : '#ffffff',
                        color: isActive ? '#1d4ed8' : isCurrentFloor ? '#047857' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      <span>{room.isComputerRoom ? '🖥️ ' : ''}{room.name}</span>
                      {room.isComputerRoom && (
                        <span style={{ fontSize: '0.66rem', background: '#e0e7ff', color: '#3730a3', padding: '0.08rem 0.3rem', borderRadius: '4px' }}>
                          Ordi
                        </span>
                      )}
                      <span style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 500 }}>
                        (Bât. {room.building}, Étage {room.floor})
                      </span>
                      {!isCurrentFloor && (
                        <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 800 }}>
                          →
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsMultiRoomCardDismissed(false)}
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '94px',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                color: '#047857',
                border: '2px solid #10b981',
                borderRadius: '24px',
                padding: '0.45rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                zIndex: 1000,
                transition: 'all 150ms ease',
              }}
              title="Afficher la liste des salles sélectionnées"
            >
              <span>📍</span>
              <span>{matchedRooms.length} salles sélectionnées</span>
              <span style={{ fontSize: '0.72rem', background: '#10b981', color: '#ffffff', borderRadius: '12px', padding: '0.15rem 0.45rem', fontWeight: 700 }}>
                Afficher ▲
              </span>
            </button>
          )
        ) : activeRoom ? (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '94px',
              right: '24px',
              maxWidth: '360px',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(12px)',
              padding: '1.1rem',
              borderRadius: 'var(--s4s-radius-lg)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              border: '1px solid var(--s4s-border)',
              zIndex: 1000,
            }}
          >
            <button
              onClick={() => setActiveRoomId(null)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'none',
                border: 'none',
                fontSize: '1.25rem',
                cursor: 'pointer',
                color: 'var(--s4s-text-muted)',
              }}
            >
              &times;
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--s4s-text-primary)' }}>
                {activeRoom.isComputerRoom ? '🖥️ ' : '🚪 '}{activeRoom.name}
              </h3>
              {activeRoom.isComputerRoom && (
                <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 700 }}>
                  🖥️ Salle informatique
                </span>
              )}
            </div>

            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--s4s-text-secondary)', display: 'flex', gap: '1rem' }}>
              <span>📍 Bâtiment: <strong>{activeRoom.building}</strong></span>
              <span>Étage: <strong>{activeRoom.floor}</strong></span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
