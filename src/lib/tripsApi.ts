import { apiUrl } from './api'
import type { Place, TripRequest } from '../types'

export type TripStopInput = {
  placeId: string
  placeName: string
  category: string
  area: string
  latitude: number
  longitude: number
  estimatedCost: number
  durationMin: number
  metadata: Record<string, unknown>
}

export type TripInput = {
  title: string
  description: string
  startArea: string
  dateStart: string
  dateEnd: string
  companion: TripRequest['companion']
  headcount: number
  budgetPerPerson: number
  transport: TripRequest['transport']
  weather: TripRequest['weather']
  likes: string[]
  dislikes: string[]
  routeCoordinates: unknown[]
  isPublic: boolean
  stops: TripStopInput[]
}

export type Trip = TripInput & { id: string; shareToken: string | null; createdAt: string; updatedAt: string; stopCount?: number }

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해주세요.' : body.error || '요청을 처리하지 못했습니다.') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return body.data ?? body
}

export function toTripInput(request: TripRequest, places: Place[] | Place[][], title: string, isPublic: boolean): TripInput {
  const days = Array.isArray(places[0]) ? places as Place[][] : [places as Place[]]
  return {
    title, description: '', startArea: request.start, dateStart: request.dateStart, dateEnd: request.dateEnd,
    companion: request.companion, headcount: request.headcount, budgetPerPerson: request.budgetPerPerson,
    transport: request.transport, weather: request.weather, likes: request.likes, dislikes: request.dislikes,
    routeCoordinates: [], isPublic,
    stops: days.flatMap((day, dayIndex) => day.map((place) => ({
      placeId: place.id, placeName: place.name, category: place.category, area: place.area,
      latitude: place.lat, longitude: place.lng, estimatedCost: place.price || 0, durationMin: place.durationMin || 0,
      metadata: { place, dayIndex },
    }))),
  }
}

export const createTrip = (input: TripInput, token: string) => request<Trip>('/api/trips', token, { method: 'POST', body: JSON.stringify(input) })
export const listTrips = (token: string) => request<Trip[]>('/api/trips', token)
export const getTrip = (id: string, token: string) => request<Trip>(`/api/trips/${encodeURIComponent(id)}`, token)
export const updateTrip = (id: string, input: TripInput, token: string) => request<Trip>(`/api/trips/${encodeURIComponent(id)}`, token, { method: 'PUT', body: JSON.stringify(input) })
export const deleteTrip = (id: string, token: string) => request<{ ok: boolean }>(`/api/trips/${encodeURIComponent(id)}`, token, { method: 'DELETE' })
export const getSharedTrip = (shareToken: string) => request<Trip>(`/api/share/trips/${encodeURIComponent(shareToken)}`)
