import type { Category, Place } from '../types'
import { apiUrl } from './api'

export type PlaceSearchParams = { area?: string; category?: Category; q?: string; limit?: number; lat?: number; lng?: number; radius?: number }
export type PlacesResponse = { data: Place[]; meta: { total: number; area: string; category: string } }

export async function searchPlaces(params: PlaceSearchParams, signal?: AbortSignal): Promise<PlacesResponse> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)) })
  const response = await fetch(apiUrl(`/api/places?${query}`), { signal })
  if (!response.ok) throw new Error('장소 검색 API에 연결하지 못했습니다.')
  return response.json() as Promise<PlacesResponse>
}
