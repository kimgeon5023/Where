import type { Place } from '../types'

const storageKey = 'where-saved-places'

export function getSavedPlaces(): Place[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function savePlaces(places: Place[]) {
  localStorage.setItem(storageKey, JSON.stringify(places))
}

export function toggleSavedPlace(current: Place[], place: Place) {
  const exists = current.some((item) => item.id === place.id)
  const next = exists ? current.filter((item) => item.id !== place.id) : [...current, place]
  savePlaces(next)
  return next
}
