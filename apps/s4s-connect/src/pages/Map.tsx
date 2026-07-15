import { useEffect, useRef, useState, useMemo } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

export interface CampusPlace {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  rooms?: string[];
}

export const CAMPUS_PLACES: CampusPlace[] = [
  {
    id: 'CM',
    code: 'CM',
    name: 'Bâtiment CM',
    latitude: 46.520505,
    longitude: 6.566699,
    rooms: ['CM 1.1', 'CM 1.2', 'CM 1.3', 'CM 1.4', 'CM 1.5', 'CM 120', 'CM 121', 'CM 112', 'CM 110']
  },
  {
    id: 'CE',
    code: 'CE',
    name: 'Bâtiment CE',
    latitude: 46.520505,
    longitude: 6.569773,
    rooms: ['CE1 1', 'CE1 2', 'CE1 3', 'CE 1 4', 'CE1 5']
  },
  {
    id: 'BS',
    code: 'BS',
    name: 'Bâtiment BS',
    latitude: 46.520505,
    longitude: 6.571383,
    rooms: ['BS 150', 'BS 160', 'BS 170', 'BS 260', 'BS 270']
  },
  {
    id: 'CO',
    code: 'CO',
    name: 'Bâtiment CO',
    latitude: 46.520055,
    longitude: 6.564586,
    rooms: ['CO 1', 'CO 2', 'CO 3', 'CO 120']
  },
  {
    id: 'INF',
    code: 'INF',
    name: 'Bâtiment INF',
    latitude: 46.518757,
    longitude: 6.563787,
    rooms: ['INF 213']
  },
  {
    id: 'INM',
    code: 'INM',
    name: 'Bâtiment INM',
    latitude: 46.518546,
    longitude: 6.563159,
    rooms: ['INM 201', 'INM 202', 'INM 203']
  },
  {
    id: 'DIA',
    code: 'DIA',
    name: 'Bâtiment DIA',
    latitude: 46.519103,
    longitude: 6.563738,
    rooms: ['DIA 004', 'DIA 005']
  },
  {
    id: 'BC',
    code: 'BC',
    name: 'Bâtiment BC',
    latitude: 46.518535,
    longitude: 6.561925,
    rooms: ['BC 01', 'BC 02', 'BC 03', 'BC 04', 'BC 07', 'BC 08']
  },
  {
    id: 'forum',
    code: 'RLC',
    name: 'Forum Rolex Learning Center',
    latitude: 46.518085,
    longitude: 6.567370,
    rooms: ['Forum Rolex']
  },
  {
    id: 'agora',
    code: 'agora',
    name: 'Agora',
    latitude: 46.518450,
    longitude: 6.566265,
    rooms: ['Agora']
  },
]

export default function MapPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({})

  const [mapLoaded, setMapLoaded] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<CampusPlace | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Parse highlighted places from URL parameter (e.g. ?places=CO,RLC)
  const urlHighlightCodes = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const val = params.get('places') || params.get('place')
    if (!val) return []
    return val.split(',').map((c) => c.trim().toUpperCase())
  }, [location.search])

  // Filter places based on search bar
  const filteredPlaces = useMemo(() => {
    if (!searchQuery.trim()) return CAMPUS_PLACES
    const q = searchQuery.toLowerCase()
    return CAMPUS_PLACES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.rooms?.some((r) => r.toLowerCase().includes(q))
    )
  }, [searchQuery])

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Create MapLibre map instance using free OSM tile source
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [6.5668, 46.5191], // Center at EPFL Esplanade
      zoom: 15.5,
      maxZoom: 18,
      minZoom: 14
    })

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      mapInstance.current = map
      setMapLoaded(true)
    })

    return () => {
      map.remove()
    }
  }, [])

  // Manage Markers
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove())
    markersRef.current = {}

    // Create new markers
    CAMPUS_PLACES.forEach((place) => {
      const isHighlighted = urlHighlightCodes.includes(place.code.toUpperCase()) || 
                            urlHighlightCodes.includes(place.id.toUpperCase())

      // Create Custom HTML element for marker
      const el = document.createElement('div')
      el.className = `custom-map-marker ${isHighlighted ? 'highlighted' : ''}`
      el.innerHTML = `
        <div class="marker-pin">
          <span class="marker-code">${place.code}</span>
        </div>
        <div class="marker-shadow"></div>
      `

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSelectedPlace(place)
        mapInstance.current?.flyTo({
          center: [place.longitude, place.latitude],
          zoom: 17,
          essential: true
        })
      })

      // Add to map
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(mapInstance.current!)

      markersRef.current[place.id] = marker
    })
  }, [mapLoaded, urlHighlightCodes])

  // Center / Fit Bounds based on URL Query Places
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded || urlHighlightCodes.length === 0) return

    const matchedPlaces = CAMPUS_PLACES.filter(
      (p) => urlHighlightCodes.includes(p.code.toUpperCase()) || 
             urlHighlightCodes.includes(p.id.toUpperCase())
    )

    if (matchedPlaces.length === 1) {
      const p = matchedPlaces[0]
      setSelectedPlace(p)
      mapInstance.current.flyTo({
        center: [p.longitude, p.latitude],
        zoom: 17,
        essential: true
      })
    } else if (matchedPlaces.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      matchedPlaces.forEach((p) => bounds.extend([p.longitude, p.latitude]))

      // Fit all highlighted places in viewport
      mapInstance.current.fitBounds(bounds, {
        padding: { top: 80, bottom: 120, left: 80, right: 80 },
        maxZoom: 17,
        duration: 1200
      })
    }
  }, [mapLoaded, urlHighlightCodes])

  // Fly to selected place
  const handlePlaceSelect = (place: CampusPlace) => {
    setSelectedPlace(place)
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: [place.longitude, place.latitude],
        zoom: 17.5,
        essential: true
      })
    }
  }

  // Clear URL highlights and show all
  const handleClearUrlFilters = () => {
    navigate({ to: '/map', search: {} } as any)
    setSelectedPlace(null)
    if (mapInstance.current) {
      mapInstance.current.flyTo({
        center: [6.5668, 46.5191],
        zoom: 15.5,
        essential: true
      })
    }
  }

  return (
    <div className="map-page-container">
      {/* Search and Sidebar Controls */}
      <div className="map-sidebar">
        <div className="map-search-box">
          <svg className="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Rechercher un bâtiment, salle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
              &times;
            </button>
          )}
        </div>

        {urlHighlightCodes.length > 0 && (
          <div className="active-map-filter-alert">
            <span>Filtre d'URL actif ({urlHighlightCodes.join(', ')})</span>
            <button onClick={handleClearUrlFilters}>Effacer</button>
          </div>
        )}

        <div className="places-list">
          {filteredPlaces.length > 0 ? (
            filteredPlaces.map((place) => {
              const isUrlHighlighted = urlHighlightCodes.includes(place.code.toUpperCase()) || 
                                        urlHighlightCodes.includes(place.id.toUpperCase())
              const isSelected = selectedPlace?.id === place.id

              return (
                <div
                  key={place.id}
                  onClick={() => handlePlaceSelect(place)}
                  className={`place-list-item ${isSelected ? 'selected' : ''} ${isUrlHighlighted ? 'url-highlighted' : ''}`}
                >
                  <div className="place-item-header">
                    <span className="place-item-code">{place.code}</span>
                    <h4 className="place-item-name">{place.name}</h4>
                  </div>
                  {place.rooms && (
                    <div className="place-item-rooms">
                      {place.rooms.slice(0, 4).map((r) => (
                        <span key={r} className="room-pill">{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="no-places-found">Aucun lieu ne correspond à votre recherche.</div>
          )}
        </div>
      </div>

      {/* Map Element */}
      <div className="map-viewport-wrapper">
        <div ref={mapContainerRef} className="map-viewport-div" />

        {/* Floating Detail Card (Mobile overlay) */}
        {selectedPlace && (
          <div className="place-detail-floating-card">
            <button className="close-floating-card-btn" onClick={() => setSelectedPlace(null)}>
              &times;
            </button>
            <div className="detail-header">
              <span className="detail-code">{selectedPlace.code}</span>
              <h3>{selectedPlace.name}</h3>
            </div>
            {selectedPlace.rooms && (
              <div className="detail-rooms">
                <strong>Salles courantes: </strong>
                {selectedPlace.rooms.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
