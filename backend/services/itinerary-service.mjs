import { distanceKm, optimizePlaces } from './route-service.mjs'

const slots = [
  { time: '10:00', emoji: '🌤️' },
  { time: '12:30', emoji: '🍽️' },
  { time: '14:30', emoji: '☕' },
  { time: '16:30', emoji: '🎟️' },
  { time: '19:00', emoji: '🌙' },
]

function preference(place, likes) {
  return likes.find((tag) => place.tags.includes(tag)) || place.tags[0] || place.category
}

export function selectDiversePlaces(scored, conditions, days) {
  const target = Math.min(16, Math.max(5, days * 5))
  const selected = []
  const counts = new Map()
  const candidates = scored.filter((item) => item.place.category !== 'lodging')
  const tooClose = (candidate) => selected.some((item) => distanceKm(candidate.place, item.place) < 0.18)
  while (selected.length < target) {
    const candidate = candidates
      .filter((item) => !selected.some((chosen) => chosen.place.id === item.place.id))
      .sort((a, b) => {
        const penalty = (item) => ((counts.get(preference(item.place, conditions.likes)) || 0) * 14) + (tooClose(item) ? 25 : 0)
        return (b.fitScore - penalty(b)) - (a.fitScore - penalty(a))
      })[0]
    if (!candidate) break
    selected.push(candidate)
    const key = preference(candidate.place, conditions.likes)
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return selected
}

export function buildItineraries(scored, conditions, days, origin) {
  const selected = selectDiversePlaces(scored, conditions, days)
  const perDay = Math.max(3, Math.ceil(selected.length / days))
  return Array.from({ length: days }, (_, day) => {
    const places = selected.slice(day * perDay, (day + 1) * perDay).map((item) => item.place)
    const start = day === 0 ? origin : places[0] || origin
    return optimizePlaces(start, places, conditions.transport).map((place, index) => ({ ...slots[Math.min(index, slots.length - 1)], place }))
  })
}
