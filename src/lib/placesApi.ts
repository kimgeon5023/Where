import type { Category, Companion, Place, Tag } from '../types'
import { apiUrl } from './api'

export type PlaceSearchParams = { area?: string; category?: Category; companion?: Companion; q?: string; tags?: Tag[]; includeLodging?: boolean; page?: number; limit?: number; lat?: number; lng?: number; radius?: number; south?: number; north?: number; west?: number; east?: number; zoom?: number }
export type PlacesResponse = { data: Place[]; meta: { total: number; area: string; category: string; source?: string; page?: number; hasMore?: boolean } }
export type RouteResponse = { data: { coordinates: { lat: number; lng: number }[]; distanceMeters: number; durationSeconds: number } }
export type RouteRequest = { origin: { lat: number; lng: number }; stops: { lat: number; lng: number }[]; transport: 'car' | 'public' }

const cacheTtlMs = 3 * 60 * 1000
const searchCacheMaxEntries = 80
const routeCacheMaxEntries = 40
const searchCache = new Map<string, { value: PlacesResponse; expiresAt: number }>()
const routeCache = new Map<string, { value: RouteResponse; expiresAt: number }>()

function cached<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string) {
  const entry = cache.get(key)
  if (!entry || entry.expiresAt <= Date.now()) { cache.delete(key); return null }
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function remember<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T, maxEntries: number) {
  const now = Date.now()
  for (const [cachedKey, entry] of cache) if (entry.expiresAt <= now) cache.delete(cachedKey)
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value
    if (oldestKey === undefined) break
    cache.delete(oldestKey)
  }
  cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs })
  return value
}

export async function searchPlaces(params: PlaceSearchParams, signal?: AbortSignal): Promise<PlacesResponse> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length) query.set(key, value.join(','))
    else if (value !== undefined && value !== '' && value !== false) query.set(key, String(value))
  })
  const key = query.toString()
  const previous = cached(searchCache, key)
  if (previous) return previous
  const response = await fetch(apiUrl(`/api/places?${query}`), { signal })
  const preview = await response.clone().json().catch(() => null) as { data?: Place[]; error?: string } | null
  if (!response.ok || !Array.isArray(preview?.data)) throw new Error(preview?.error || '카카오 장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
  if (!response.ok) throw new Error('장소 검색 API에 연결하지 못했습니다.')
  return remember(searchCache, key, await response.json() as PlacesResponse, searchCacheMaxEntries)
}

export async function searchRoute(params: RouteRequest, signal?: AbortSignal): Promise<RouteResponse> {
  const key = JSON.stringify(params)
  const previous = cached(routeCache, key)
  if (previous) return previous
  const response = await fetch(apiUrl('/api/route'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal,
  }).catch(() => null)
  if (response?.ok) return remember(routeCache, key, await response.json() as RouteResponse, routeCacheMaxEntries)

  // Keep road distance available even while Render is waking or its routing
  // provider is not configured. OSRM also returns a fastest driving route.
  if (params.transport !== 'car') throw new Error('차량 경로만 계산할 수 있습니다.')
  const points = [params.origin, ...params.stops].map((point) => `${point.lng},${point.lat}`).join(';')
  const fallback = await fetch(`https://router.project-osrm.org/route/v1/driving/${points}?overview=full&geometries=geojson&steps=false`, { signal })
  if (!fallback.ok) throw new Error('빠른 도로 경로를 불러오지 못했습니다.')
  const payload = await fallback.json() as { routes?: { distance: number; duration: number; geometry?: { coordinates?: [number, number][] } }[] }
  const route = payload.routes?.[0]
  const coordinates = route?.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || []
  if (!route || coordinates.length < 2) throw new Error('빠른 도로 경로를 찾지 못했습니다.')
  return remember(routeCache, key, { data: { coordinates, distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration) } }, routeCacheMaxEntries)
}
