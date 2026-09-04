import type { Place } from '../types'

const legacyStorageKey = 'where-saved-places'
const lastFavoriteAccountKey = 'where-last-favorite-account'

function favoriteSnapshotKey(userId: string) {
  return `where-account-favorites:${userId}`
}

function validPlaces(value: unknown): Place[] {
  return Array.isArray(value)
    ? value.filter((place): place is Place => Boolean(place && typeof place.id === 'string' && typeof place.name === 'string'))
    : []
}

export function getLegacyFavorites(): Place[] {
  try {
    const saved = JSON.parse(localStorage.getItem(legacyStorageKey) || '[]')
    return validPlaces(saved)
  } catch {
    return []
  }
}

export function clearLegacyFavorites() {
  localStorage.removeItem(legacyStorageKey)
}

export function saveFavoriteSnapshot(userId: string, places: Place[]) {
  try {
    localStorage.setItem(favoriteSnapshotKey(userId), JSON.stringify(places))
    localStorage.setItem(lastFavoriteAccountKey, userId)
  } catch { /* Storage is optional. */ }
}

export function getFavoriteSnapshot(userId: string): Place[] {
  try {
    return validPlaces(JSON.parse(localStorage.getItem(favoriteSnapshotKey(userId)) || '[]'))
  } catch {
    return []
  }
}

export function getLastFavoriteSnapshot(): Place[] {
  try {
    const userId = localStorage.getItem(lastFavoriteAccountKey)
    return userId ? getFavoriteSnapshot(userId) : []
  } catch {
    return []
  }
}
