import type { Place } from '../types'
import { apiUrl } from './api'

export interface FavoriteRecord {
  id: string
  placeId: string
  placeName: string
  address: string
  category: string
  imageUrl: string
  latitude: number | null
  longitude: number | null
  place: Partial<Place>
  createdAt: string
}

function authorization(token: string) {
  return { Authorization: `Bearer ${token}` }
}

async function responseBody(response: Response) {
  return response.json() as Promise<{ data?: FavoriteRecord | FavoriteRecord[]; error?: string }>
}

export async function getFavorites(token: string, signal?: AbortSignal): Promise<FavoriteRecord[]> {
  const response = await fetch(apiUrl('/api/favorites'), { headers: authorization(token), signal })
  const body = await responseBody(response)
  if (!response.ok || !Array.isArray(body.data)) throw new Error(body.error || '찜 목록을 불러오지 못했습니다.')
  return body.data
}

export async function createFavorite(token: string, place: Place): Promise<FavoriteRecord> {
  const response = await fetch(apiUrl('/api/favorites'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authorization(token) },
    body: JSON.stringify({
      placeId: place.id,
      placeName: place.name,
      address: place.area,
      category: place.category,
      imageUrl: place.image,
      latitude: place.lat,
      longitude: place.lng,
      place,
    }),
  })
  const body = await responseBody(response)
  if (!response.ok || Array.isArray(body.data) || !body.data) throw new Error(body.error || '찜한 장소를 저장하지 못했습니다.')
  return body.data
}

export async function removeFavorite(token: string, placeId: string) {
  const response = await fetch(apiUrl(`/api/favorites/${encodeURIComponent(placeId)}`), { method: 'DELETE', headers: authorization(token) })
  if (!response.ok) {
    const body = await responseBody(response)
    throw new Error(body.error || '찜한 장소를 삭제하지 못했습니다.')
  }
}
