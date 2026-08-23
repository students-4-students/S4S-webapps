import L from 'leaflet'
import 'proj4'
import 'proj4leaflet'

export const EPFL_CENTER: [number, number] = [46.5185, 6.5666]
export const EPFL_INITIAL_ZOOM = 21

const SWISS_PROJ4_DEF =
  '+proj=somerc +lat_0=46.95240555555556 +lon_0=7.439583333333333 +k_0=1 +x_0=2600000 +y_0=1200000 +ellps=bessel +towgs84=674.374,15.056,405.346,0,0,0,0 +units=m +no_defs'
const SWISS_GRID_ORIGIN: [number, number] = [2420000, 1350000]

const NATIVE_RESOLUTIONS = [
  4000, 3750, 3500, 3250, 3000, 2750, 2500, 2250, 2000, 1750, 1500, 1250, 1000, 750, 650, 500, 250,
  100, 50, 20, 10, 5, 2.5, 2, 1.5, 1, 0.5, 0.25, 0.1, 0.05,
]
const EXTRA_ZOOM_LEVELS = 2
export const SWISS_RESOLUTIONS = [
  ...NATIVE_RESOLUTIONS,
  ...Array.from(
    { length: EXTRA_ZOOM_LEVELS },
    (_, i) => NATIVE_RESOLUTIONS[NATIVE_RESOLUTIONS.length - 1] / 2 ** (i + 1),
  ),
]
export const MAX_ZOOM = SWISS_RESOLUTIONS.length - 1
const BUILDINGS_MAX_NATIVE_ZOOM = NATIVE_RESOLUTIONS.length - 1
const BASE_LAYERS_MAX_NATIVE_ZOOM = NATIVE_RESOLUTIONS.length - 2

const EPFL_TILES_URL =
  'https://prod-plan-epfl-tiles{s}.epfl.ch/1.0.0/{layer}/default/{date}/{floorPath}2056/{z}/{y}/{x}.png'
const EPFL_TILE_SUBDOMAINS = ['0', '1', '2', '3', '4']

const AERIAL_TILES_URL =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage-product/default/current/2056/{z}/{x}/{y}.jpeg'

const ROOM_LABELS_URL = 'https://plan.epfl.ch/mapserv_proxy'
const ROOM_LABELS_LAYER = 'locaux_labels'
export const ROOM_LABELS_PANE = 'roomLabelsPane'
const ROOM_LABELS_MAX_METERS_PER_PIXEL = 0.264
const ROOM_LABELS_MAX_PX = 4000
const ROOM_LABELS_DEBOUNCE_MS = 250

export function createSwissCrs(): L.CRS {
  return new (L.Proj as any).CRS('EPSG:2056', SWISS_PROJ4_DEF, {
    origin: SWISS_GRID_ORIGIN,
    resolutions: SWISS_RESOLUTIONS,
  }) as unknown as L.CRS
}

export function createPlanPanes(map: L.Map) {
  map.createPane('osmBasePane').style.zIndex = '200'
  map.createPane('aerialPane').style.zIndex = '300'
  map.createPane('buildingsPane').style.zIndex = '400'
  map.createPane(ROOM_LABELS_PANE).style.zIndex = '450'
  map.createPane('drawingsPane').style.zIndex = '500'
}

export interface BackgroundLayers {
  osm: L.TileLayer
  aerial: L.TileLayer
  buildings: L.TileLayer
}

export function createBackgroundLayers(floor: number): BackgroundLayers {
  const baseZoomBounds = {
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: BASE_LAYERS_MAX_NATIVE_ZOOM,
  }
  const buildingsZoomBounds = {
    minZoom: 0,
    maxZoom: MAX_ZOOM,
    maxNativeZoom: BUILDINGS_MAX_NATIVE_ZOOM,
  }

  return {
    osm: L.tileLayer(EPFL_TILES_URL, {
      ...baseZoomBounds,
      pane: 'osmBasePane',
      subdomains: EPFL_TILE_SUBDOMAINS,
      layer: 'osm-wmts',
      date: '20250317',
      floorPath: '',
      attribution: '&copy; EPFL &middot; OpenStreetMap contributors',
    } as any),

    aerial: L.tileLayer(AERIAL_TILES_URL, {
      ...baseZoomBounds,
      pane: 'aerialPane',
      attribution: '&copy; swisstopo',
    }),

    buildings: L.tileLayer(EPFL_TILES_URL, {
      ...buildingsZoomBounds,
      pane: 'buildingsPane',
      subdomains: EPFL_TILE_SUBDOMAINS,
      layer: 'batiments',
      date: '20231011',
      floorPath: `${floor}/`,
    } as any),
  }
}

export function metersPerPixel(map: L.Map | undefined): number {
  if (!map) return SWISS_RESOLUTIONS[EPFL_INITIAL_ZOOM]
  const scale = map.options.crs?.scale(map.getZoom()) ?? 0
  return scale > 0 ? 1 / scale : SWISS_RESOLUTIONS[EPFL_INITIAL_ZOOM]
}

function roomLabelsRequest(map: L.Map, floor: number) {
  const size = map.getSize()
  if (size.x < 1 || size.y < 1) return undefined
  if (metersPerPixel(map) > ROOM_LABELS_MAX_METERS_PER_PIXEL) return undefined

  const crs = map.options.crs
  if (!crs) return undefined

  const northWest = map.containerPointToLatLng([0, 0])
  const southEast = map.containerPointToLatLng([size.x, size.y])
  const a = crs.project(northWest)
  const b = crs.project(southEast)

  const params = new URLSearchParams({
    ogcserver: 'MapServer',
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: ROOM_LABELS_LAYER,
    STYLES: '',
    SRS: 'EPSG:2056',
    BBOX: [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)].join(
      ',',
    ),
    WIDTH: String(Math.min(Math.round(size.x), ROOM_LABELS_MAX_PX)),
    HEIGHT: String(Math.min(Math.round(size.y), ROOM_LABELS_MAX_PX)),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    floor: String(floor),
  })

  return {
    url: `${ROOM_LABELS_URL}?${params.toString()}`,
    bounds: L.latLngBounds(northWest, southEast),
  }
}

export interface RoomLabelsController {
  setFloor(floor: number): void
  setEnabled(enabled: boolean): void
  destroy(): void
}

export function createRoomLabels(
  map: L.Map,
  initial: { floor: number; enabled: boolean }
): RoomLabelsController {
  let floor = initial.floor
  let enabled = initial.enabled
  let current: L.ImageOverlay | undefined
  let pending: L.ImageOverlay | undefined
  let timer: number | undefined

  const drop = (overlay: L.ImageOverlay | undefined) => {
    if (overlay) map.removeLayer(overlay)
  }

  const refresh = () => {
    const request = enabled ? roomLabelsRequest(map, floor) : undefined
    if (!request) {
      drop(pending)
      drop(current)
      pending = undefined
      current = undefined
      return
    }

    const next = L.imageOverlay(request.url, request.bounds, {
      pane: ROOM_LABELS_PANE,
      interactive: false,
    })
    next.once('load', () => {
      drop(current)
      current = next
      pending = undefined
    })
    next.once('error', () => {
      drop(next)
      if (pending === next) pending = undefined
    })
    drop(pending)
    pending = next
    next.addTo(map)
  }

  const schedule = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(refresh, ROOM_LABELS_DEBOUNCE_MS)
  }

  map.on('moveend zoomend resize', schedule)
  refresh()

  return {
    setFloor(value: number) {
      floor = value
      refresh()
    },
    setEnabled(value: boolean) {
      enabled = value
      refresh()
    },
    destroy() {
      window.clearTimeout(timer)
      map.off('moveend zoomend resize', schedule)
      drop(pending)
      drop(current)
      pending = undefined
      current = undefined
    },
  }
}

export const EPFL_BUILDING_COORDS: Record<string, { latitude: number; longitude: number; defaultFloor: number }> = {
  BC: { latitude: 46.518535, longitude: 6.561925, defaultFloor: 0 },
  CO: { latitude: 46.520055, longitude: 6.564586, defaultFloor: 0 },
  CM: { latitude: 46.520505, longitude: 6.566699, defaultFloor: 1 },
  CE: { latitude: 46.520505, longitude: 6.569773, defaultFloor: 1 },
  INF: { latitude: 46.518757, longitude: 6.563787, defaultFloor: 0 },
  BS: { latitude: 46.520505, longitude: 6.571383, defaultFloor: 1 },
  RLC: { latitude: 46.518085, longitude: 6.56737, defaultFloor: 0 },
  SG: { latitude: 46.519505, longitude: 6.5657, defaultFloor: 0 },
  GC: { latitude: 46.5201, longitude: 6.563, defaultFloor: 0 },
  INM: { latitude: 46.518546, longitude: 6.563159, defaultFloor: 0 },
  DIA: { latitude: 46.519103, longitude: 6.563738, defaultFloor: 0 },
}
