import type { Category, Place, TripRequest } from '../types'

export interface ScoreDetail {
  label: string
  max: number
  value: number
}

export interface ScoredPlace {
  place: Place
  score: number
  detail: ScoreDetail[]
  reasons: string[]
}

export function recommend(places: Place[], req: TripRequest, excludedIds: string[] = []): ScoredPlace[] {
  return places
    .filter((place) => !excludedIds.includes(place.id))
    .filter((place) => !place.tags.some((tag) => req.dislikes.includes(tag)))
    .map((place) => {
      const liked = place.tags.filter((tag) => req.likes.includes(tag)).length
      const taste = Math.min(30, liked * 15)
      const group = place.groupFit.includes(req.companion) ? 20 : 4
      const budget = place.price <= req.budgetPerPerson ? (place.price < req.budgetPerPerson * 0.25 ? 20 : 15) : 4
      const rainMode = req.weather === 'rain'
      const weather = (rainMode && place.indoor) || (!rainMode && !place.indoor) ? 15 : 5
      const distance = place.area === '성수' || place.area === '홍대' ? 10 : 6
      const rating = Math.min(5, Math.round(place.rating))
      const detail = [
        { label: '취향 일치', max: 30, value: taste },
        { label: '동행 적합', max: 20, value: group },
        { label: '예산 적합', max: 20, value: budget },
        { label: '날씨 적합', max: 15, value: weather },
        { label: '이동 편의', max: 10, value: distance },
        { label: '평점', max: 5, value: rating },
      ]
      const reasons: string[] = []
      if (liked > 0) reasons.push('선호 태그와 잘 맞아요')
      if (place.groupFit.includes(req.companion)) reasons.push('함께 가는 사람과 잘 맞아요')
      if (rainMode && place.indoor) reasons.push('비 오는 날에도 즐길 수 있어요')
      if (!rainMode && !place.indoor) reasons.push('오늘 날씨에 딱 좋은 야외 코스예요')
      return { place, score: detail.reduce((sum, item) => sum + item.value, 0), detail, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

export function estimateBudget(req: TripRequest, course: ScoredPlace[]) {
  const transport = req.transport === 'car' ? 30000 : 6000
  const lodging = course.find((item) => item.place.category === 'lodging')?.place.lodging
  const lodgingCost = lodging ? Math.round(lodging.pricePerNight / Math.max(1, req.headcount)) : 0
  const food = course.filter((item) => item.place.category === 'food').reduce((sum, item) => sum + item.place.price, 0)
  const activity = course
    .filter((item) => !['food', 'lodging', 'cafe'].includes(item.place.category))
    .reduce((sum, item) => sum + item.place.price, 0)
  const cafe = course.filter((item) => item.place.category === 'cafe').reduce((sum, item) => sum + item.place.price, 0)
  const items = [
    { label: '교통비', cost: transport },
    ...(lodgingCost ? [{ label: '숙소', cost: lodgingCost }] : []),
    { label: '식비', cost: food },
    { label: '놀거리', cost: activity },
    { label: '카페', cost: cafe },
  ]
  const total = items.reduce((sum, item) => sum + item.cost, 0)
  return { items, total, perPerson: Math.round(total) }
}

export interface ItineraryStop {
  time: string
  emoji: string
  place: Place
}

const slots: { time: string; emoji: string; categories: Category[] }[] = [
  { time: '10:00', emoji: '☀️', categories: ['tour', 'photo'] },
  { time: '12:30', emoji: '🍽️', categories: ['food'] },
  { time: '14:30', emoji: '☕', categories: ['cafe'] },
  { time: '16:30', emoji: '🎟️', categories: ['activity'] },
  { time: '19:00', emoji: '🌙', categories: ['food', 'tour', 'photo'] },
]

export function buildItineraries(scored: ScoredPlace[], days: number): ItineraryStop[][] {
  const used = new Set<string>()
  const result: ItineraryStop[][] = []
  for (let day = 0; day < days; day += 1) {
    const available = scored.filter((item) => !used.has(item.place.id))
    const stops: ItineraryStop[] = []
    const categories = new Set<Category>()
    for (const slot of slots) {
      const match = available.find((item) => slot.categories.includes(item.place.category) && !categories.has(item.place.category))
      if (match) {
        categories.add(match.place.category)
        used.add(match.place.id)
        stops.push({ time: slot.time, emoji: slot.emoji, place: match.place })
      }
    }
    const lodging = available.find((item) => item.place.category === 'lodging')
    if (lodging && day === 0) {
      used.add(lodging.place.id)
      stops.push({ time: '21:30', emoji: '🛏️', place: lodging.place })
    }
    result.push(stops)
  }
  return result
}
