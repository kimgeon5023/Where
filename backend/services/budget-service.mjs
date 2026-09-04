function tripDays(conditions) {
  return Math.max(1, Math.round((new Date(conditions.dateEnd).getTime() - new Date(conditions.dateStart).getTime()) / 86400000) + 1)
}

function costOf(place) {
  return Math.max(0, Number(place.estimatedCost ?? place.price ?? 0) || 0)
}

export function estimateBudget(conditions, places, transportCost) {
  const unique = [...new Map(places.filter((place) => place.category !== 'lodging').map((place) => [place.id, place])).values()]
  const transport = Number.isFinite(transportCost) && transportCost >= 0
    ? Math.round(transportCost)
    : (conditions.transport === 'car' ? 30_000 : 6_000) * tripDays(conditions)
  const food = unique.filter((place) => place.category === 'food').reduce((sum, place) => sum + costOf(place), 0)
  const activity = unique.filter((place) => ['tour', 'photo', 'activity'].includes(place.category) && !place.tags.includes('shopping')).reduce((sum, place) => sum + costOf(place), 0)
  const other = unique.filter((place) => place.category === 'cafe' || place.tags.includes('shopping')).reduce((sum, place) => sum + costOf(place), 0)
  const items = [
    { label: '교통비', cost: transport },
    { label: '식비', cost: food },
    { label: '관광/액티비티 비용', cost: activity },
    { label: '기타 비용', cost: other },
  ]
  const total = items.reduce((sum, item) => sum + item.cost, 0)
  return { items, total, perPerson: total, estimated: true }
}
