import type { Category, Place, Tag, TripRequest } from '../types'

export interface ScoreDetail { label: string; max: number; value: number }
export interface ScoredPlace { place: Place; score: number; detail: ScoreDetail[]; reasons: string[] }
export interface ItineraryStop { time: string; emoji: string; place: Place }

const companionStyle: Record<TripRequest['companion'], Category[]> = {
  friends: ['activity', 'food', 'photo', 'cafe'], couple: ['cafe', 'tour', 'photo', 'food'],
  family: ['tour', 'activity', 'food', 'cafe'], alone: ['cafe', 'photo', 'tour', 'food'],
}
const slots = [{ time: '10:00', emoji: '🌤️' }, { time: '12:30', emoji: '🍽️' }, { time: '14:30', emoji: '☕' }, { time: '16:30', emoji: '🎟️' }, { time: '19:00', emoji: '🌙' }]

function distance(a: Place, b: Place) {
  const r = (value: number) => value * Math.PI / 180
  const dLat = r(b.lat - a.lat); const dLng = r(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
function preference(place: Place, likes: Tag[]) { return likes.find((tag) => place.tags.includes(tag)) || place.tags[0] || place.category }
function jitter(id: string, seed: number) { let value = Math.floor(seed * 1000003); for (const char of id) value = ((value * 31) + char.charCodeAt(0)) >>> 0; return (value % 700) / 100 }
function tripDays(req: TripRequest) { return Math.max(1, Math.round((new Date(req.dateEnd).getTime() - new Date(req.dateStart).getTime()) / 86400000) + 1) }
function visitCost(place: Place, req: TripRequest) { return place.category === 'lodging' && place.lodging ? Math.round(place.lodging.pricePerNight / Math.max(1, req.headcount)) : place.price }

export function recommend(places: Place[], req: TripRequest, excludedIds: string[] = [], seed = 0): ScoredPlace[] {
  return places.filter((place) => !excludedIds.includes(place.id) && !place.tags.some((tag) => req.dislikes.includes(tag))).map((place) => {
    const liked = place.tags.filter((tag) => req.likes.includes(tag)).length
    const taste = Math.min(28, liked * 14); const group = place.groupFit.includes(req.companion) ? 18 : 5
    const style = companionStyle[req.companion].includes(place.category) ? 14 : 6
    const dailyBudget = req.budgetPerPerson / tripDays(req); const cost = visitCost(place, req)
    const budget = cost <= dailyBudget * .45 ? 18 : cost <= dailyBudget ? 12 : 1
    const weather = req.weather === 'rain' ? (place.indoor ? 18 : 1) : req.weather === 'sunny' ? (!place.indoor ? 16 : 7) : (place.indoor ? 12 : 10)
    const maxDistance = req.transport === 'car' ? 14 : 5
    const travel = place.distanceKm === undefined ? 6 : Math.max(1, Math.round((maxDistance - place.distanceKm) * 1.4))
    const detail = [{ label: '취향 일치', max: 28, value: taste }, { label: '동행 적합', max: 18, value: group }, { label: '여행 스타일', max: 14, value: style }, { label: '예산 적합', max: 18, value: budget }, { label: '날씨 적합', max: 18, value: weather }, { label: '이동 편의', max: 18, value: travel }]
    const reasons = [...(liked ? ['선택한 취향과 잘 맞아요.'] : []), ...(companionStyle[req.companion].includes(place.category) ? ['동행 유형에 어울리는 장소예요.'] : []), ...(place.distanceKm !== undefined ? [`출발 기준 ${place.distanceKm.toFixed(1)}km 거리예요.`] : [])]
    return { place, score: detail.reduce((sum, item) => sum + item.value, 0) + jitter(place.id, seed), detail, reasons }
  }).sort((a, b) => b.score - a.score)
}

function nearbyOrder(items: ScoredPlace[], transport: TripRequest['transport']) {
  if (items.length < 3) return items
  const remaining = [...items].sort((a, b) => b.score - a.score); const ordered = [remaining.shift()!]
  const preferredLeg = transport === 'car' ? 7 : 2.2
  while (remaining.length) { const last = ordered.at(-1)!; remaining.sort((a, b) => (distance(last.place, a.place) + Math.max(0, distance(last.place, a.place) - preferredLeg) * 3 - a.score / 120) - (distance(last.place, b.place) + Math.max(0, distance(last.place, b.place) - preferredLeg) * 3 - b.score / 120)); ordered.push(remaining.shift()!) }
  return ordered
}

export function selectDiversePlaces(scored: ScoredPlace[], req: TripRequest, days: number, seed: number) {
  const target = Math.min(16, Math.max(5, days * 5)); const selected: ScoredPlace[] = []; const counts = new Map<string, number>(); let spent = req.transport === 'car' ? 30_000 : 6_000
  const candidates = [...scored].sort((a, b) => (b.score + jitter(b.place.id, seed)) - (a.score + jitter(a.place.id, seed)))
  const tooClose = (candidate: ScoredPlace) => selected.some((item) => distance(candidate.place, item.place) < .18)
  const add = (candidate: ScoredPlace) => { selected.push(candidate); spent += visitCost(candidate.place, req); const key = preference(candidate.place, req.likes); counts.set(key, (counts.get(key) || 0) + 1) }
  for (const taste of req.likes) { const candidate = candidates.find((item) => !selected.some((chosen) => chosen.place.id === item.place.id) && item.place.tags.includes(taste) && !tooClose(item)); if (candidate) add(candidate) }
  while (selected.length < target) {
    const candidate = candidates.filter((item) => !selected.some((chosen) => chosen.place.id === item.place.id)).sort((a, b) => {
      const penalty = (item: ScoredPlace) => ((counts.get(preference(item.place, req.likes)) || 0) * 14) + (tooClose(item) ? 25 : 0) + (spent + visitCost(item.place, req) > req.budgetPerPerson * 1.05 ? 32 : 0)
      return (b.score - penalty(b)) - (a.score - penalty(a))
    })[0]
    if (!candidate) break
    add(candidate)
  }
  return nearbyOrder(selected, req.transport)
}

export function buildItineraries(scored: ScoredPlace[], req: TripRequest, days: number, seed: number): ItineraryStop[][] {
  const selected = selectDiversePlaces(scored, req, days, seed)
  const lodging = days > 1 ? selected.find((item) => item.place.category === 'lodging') : undefined
  const visits = selected.filter((item) => item !== lodging); const perDay = Math.max(3, Math.ceil(visits.length / days))
  return Array.from({ length: days }, (_, day) => {
    const stops = nearbyOrder(visits.slice(day * perDay, (day + 1) * perDay), req.transport).map((item, index) => ({ ...slots[Math.min(index, slots.length - 1)], place: item.place }))
    if (day === 0 && lodging) stops.push({ time: '21:30', emoji: '🛏️', place: lodging.place })
    return stops
  })
}

export function estimateBudget(req: TripRequest, course: ScoredPlace[]) {
  const transport = req.transport === 'car' ? 30000 : 6000
  const food = course.filter((item) => item.place.category === 'food').reduce((sum, item) => sum + item.place.price, 0)
  const activity = course.filter((item) => !['food', 'lodging', 'cafe'].includes(item.place.category)).reduce((sum, item) => sum + item.place.price, 0)
  const cafe = course.filter((item) => item.place.category === 'cafe').reduce((sum, item) => sum + item.place.price, 0)
  const items = [{ label: '교통비', cost: transport }, { label: '식비', cost: food }, { label: '활동', cost: activity }, { label: '카페', cost: cafe }]
  const total = items.reduce((sum, item) => sum + item.cost, 0)
  return { items, total, perPerson: Math.round(total) }
}
