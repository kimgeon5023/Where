import type { Category, Companion, Place, Tag } from '../types'
import { apiUrl } from './api'

export type PlaceSearchParams = { area?: string; category?: Category; companion?: Companion; q?: string; tags?: Tag[]; includeLodging?: boolean; limit?: number; lat?: number; lng?: number; radius?: number; south?: number; north?: number; west?: number; east?: number; zoom?: number }
export type PlacesResponse = { data: Place[]; meta: { total: number; area: string; category: string; source?: string } }
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
  if (!response.ok) throw new Error('장소 검색 API에 연결하지 못했습니다.')
  return remember(searchCache, key, await response.json() as PlacesResponse, searchCacheMaxEntries)
}

export async function searchRoute(params: RouteRequest, signal?: AbortSignal): Promise<RouteResponse> {
  const key = JSON.stringify(params)
  const previous = cached(routeCache, key)
  if (previous) return previous
  const response = await fetch(apiUrl('/api/route'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal,
  })
  if (!response.ok) throw new Error(await response.json().then((body) => body.error || '경로를 불러오지 못했습니다.').catch(() => '경로를 불러오지 못했습니다.'))
  return remember(routeCache, key, await response.json() as RouteResponse, routeCacheMaxEntries)
}
