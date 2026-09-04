const companionStyle = {
  friends: ['activity', 'food', 'photo', 'cafe'],
  couple: ['cafe', 'tour', 'photo', 'food'],
  family: ['tour', 'activity', 'food', 'cafe'],
  alone: ['cafe', 'photo', 'tour', 'food'],
}

function jitter(id, seed) {
  let value = Math.floor(seed * 1000003)
  for (const character of id) value = ((value * 31) + character.charCodeAt(0)) >>> 0
  return (value % 700) / 100
}

export function recommendPlaces(places, conditions, excludedIds = [], seed = 0) {
  return places
    .filter((place) => place.category !== 'lodging' && !excludedIds.includes(place.id) && !place.tags.some((tag) => conditions.dislikes.includes(tag)))
    .map((place) => {
      const liked = place.tags.filter((tag) => conditions.likes.includes(tag)).length
      const taste = Math.min(28, liked * 14)
      const group = place.groupFit.includes(conditions.companion) ? 18 : 5
      const style = companionStyle[conditions.companion]?.includes(place.category) ? 14 : 6
      const rating = place.reviewCount ? Math.round((Math.max(1, Math.min(5, place.rating)) / 5) * 18) : 9
      const weather = conditions.weather === 'rain' ? (place.indoor ? 18 : 1) : conditions.weather === 'sunny' ? (!place.indoor ? 16 : 7) : (place.indoor ? 12 : 10)
      const maxDistance = conditions.transport === 'car' ? 14 : 5
      const travel = place.distanceKm === undefined ? 6 : Math.max(1, Math.round((maxDistance - place.distanceKm) * 1.4))
      const hours = place.operatingStatus === 'open' ? 5 : place.operatingStatus === 'closed' ? -30 : 0
      const detail = [
        { label: '취향 일치', max: 28, value: taste },
        { label: '동행 적합', max: 18, value: group },
        { label: '여행 스타일', max: 14, value: style },
        { label: '방문자 평점', max: 18, value: rating },
        { label: '날씨 적합', max: 18, value: weather },
        { label: '이동 편의', max: 18, value: travel },
        { label: '운영시간', max: 5, value: hours },
      ]
      const reasons = [
        ...(liked ? ['선택한 취향과 잘 맞아요.'] : []),
        ...(place.reviewCount ? [`방문자 평점 ${place.rating.toFixed(1)}점이에요.`] : []),
        ...(place.distanceKm !== undefined ? [`출발 기준 ${place.distanceKm.toFixed(1)}km 거리예요.`] : []),
        ...(place.operatingStatus === 'open' ? ['현재 영업 중인 장소예요.'] : []),
      ]
      const score = place.reviewCount ? Math.round(place.rating * 20) : 0
      return { place, score, fitScore: detail.reduce((sum, item) => sum + item.value, 0) + jitter(place.id, seed), detail, reasons }
    })
    .sort((a, b) => b.fitScore - a.fitScore)
}
