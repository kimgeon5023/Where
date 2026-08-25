import type { Category, Place, TripRequest } from '../types'

export interface ScoreDetail { label: string; max: number; value: number }
export interface ScoredPlace { place: Place; score: number; detail: ScoreDetail[]; reasons: string[] }

const companionStyle: Record<TripRequest['companion'], Category[]> = {
  friends: ['activity', 'food', 'photo'],
  couple: ['cafe', 'tour', 'photo'],
  family: ['tour', 'activity', 'food'],
  alone: ['cafe', 'photo', 'tour'],
}

export function recommend(places: Place[], req: TripRequest, excludedIds: string[] = []): ScoredPlace[] {
  return places
    .filter((place) => !excludedIds.includes(place.id))
    .filter((place) => !place.tags.some((tag) => req.dislikes.includes(tag)))
    .map((place) => {
      const liked = place.tags.filter((tag) => req.likes.includes(tag)).length
      const taste = Math.min(25, liked * 10)
      const group = place.groupFit.includes(req.companion) ? 20 : 4
      const style = companionStyle[req.companion].includes(place.category) ? 15 : 5
      const budget = place.price <= req.budgetPerPerson ? (place.price === 0 || place.price <= req.budgetPerPerson * .25 ? 15 : 11) : 3
      const rainMode = req.weather === 'rain'
      const weather = (rainMode && place.indoor) || (!rainMode && !place.indoor) ? 10 : 4
      const distanceKm = place.distanceKm
      const distance = distanceKm === undefined ? 6 : Math.max(1, Math.round((req.transport === 'public' ? 10 - distanceKm * 1.2 : 10 - distanceKm * .35) * 10) / 10)
      const rating = Math.min(5, Math.round(place.rating))
      const detail = [
        { label: '취향 일치', max: 25, value: taste },
        { label: '동행 적합', max: 20, value: group },
        { label: '여행 스타일', max: 15, value: style },
        { label: '예산 적합', max: 15, value: budget },
        { label: '날씨 적합', max: 10, value: weather },
        { label: '이동 편의', max: 10, value: distance },
        { label: '평점', max: 5, value: rating },
      ]
      const reasons: string[] = []
      if (liked > 0) reasons.push('좋아하는 취향과 일치합니다.')
      if (place.groupFit.includes(req.companion)) reasons.push('선택한 동행 유형에 잘 맞습니다.')
      if (companionStyle[req.companion].includes(place.category)) reasons.push('선택한 여행 스타일에 맞는 장소입니다.')
      if (distanceKm !== undefined) reasons.push(`${req.transport === 'public' ? '대중교통' : '자차'} 기준 ${distanceKm.toFixed(1)}km 거리입니다.`)
      if (rainMode && place.indoor) reasons.push('비 오는 날에도 이용하기 좋은 실내 장소입니다.')
      if (!rainMode && !place.indoor) reasons.push('날씨가 좋을 때 즐기기 좋은 야외 장소입니다.')
      return { place, score: detail.reduce((sum, item) => sum + item.value, 0), detail, reasons }
    })
    .sort((a, b) => b.score - a.score)
}

export function estimateBudget(req: TripRequest, course: ScoredPlace[]) {
  const transport = req.transport === 'car' ? 30000 : 6000
  const lodging = course.find((item) => item.place.category === 'lodging')?.place.lodging
  const lodgingCost = lodging ? Math.round(lodging.pricePerNight / Math.max(1, req.headcount)) : 0
  const food = course.filter((item) => item.place.category === 'food').reduce((sum, item) => sum + item.place.price, 0)
  const activity = course.filter((item) => !['food', 'lodging', 'cafe'].includes(item.place.category)).reduce((sum, item) => sum + item.place.price, 0)
  const cafe = course.filter((item) => item.place.category === 'cafe').reduce((sum, item) => sum + item.place.price, 0)
  const items = [{ label: '교통비', cost: transport }, ...(lodgingCost ? [{ label: '숙소', cost: lodgingCost }] : []), { label: '식비', cost: food }, { label: '활동', cost: activity }, { label: '카페', cost: cafe }]
  const total = items.reduce((sum, item) => sum + item.cost, 0)
  return { items, total, perPerson: Math.round(total) }
}

export interface ItineraryStop { time: string; emoji: string; place: Place }
const slots: { time: string; emoji: string; categories: Category[] }[] = [
  { time: '10:00', emoji: '🌤️', categories: ['tour', 'photo'] },
  { time: '12:30', emoji: '🍽️', categories: ['food'] },
  { time: '14:30', emoji: '☕', categories: ['cafe'] },
  { time: '16:30', emoji: '🎡', categories: ['activity'] },
  { time: '19:00', emoji: '🌙', categories: ['food', 'tour', 'photo'] },
]

export function buildItineraries(scored: ScoredPlace[], days: number): ItineraryStop[][] {
  const used = new Set<string>(); const result: ItineraryStop[][] = []
  for (let day = 0; day < days; day += 1) {
    const available = scored.filter((item) => !used.has(item.place.id)); const stops: ItineraryStop[] = []; const categories = new Set<Category>()
    for (const slot of slots) {
      const match = available.find((item) => slot.categories.includes(item.place.category) && !categories.has(item.place.category))
      if (match) { categories.add(match.place.category); used.add(match.place.id); stops.push({ time: slot.time, emoji: slot.emoji, place: match.place }) }
    }
    const lodging = available.find((item) => item.place.category === 'lodging')
    if (lodging && day === 0) { used.add(lodging.place.id); stops.push({ time: '21:30', emoji: '🛏️', place: lodging.place }) }
    result.push(stops)
  }
  return result
}
