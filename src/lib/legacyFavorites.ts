import type { Place } from '../types'

const legacyStorageKey = 'where-saved-places'

export function getLegacyFavorites(): Place[] {
  try {
    const saved = JSON.parse(localStorage.getItem(legacyStorageKey) || '[]')
    return Array.isArray(saved) ? saved.filter((place): place is Place => Boolean(place && typeof place.id === 'string' && typeof place.name === 'string')) : []
  } catch {
    return []
  }
}

export function clearLegacyFavorites() {
  localStorage.removeItem(legacyStorageKey)
}
