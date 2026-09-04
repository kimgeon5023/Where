export const searchableCategories = new Set(['food', 'cafe', 'tour', 'photo', 'activity'])

export const kakaoCategoryCodes = { food: 'FD6', cafe: 'CE7', tour: 'AT4', photo: 'AT4', activity: 'CT1' }

export const livePlaceMeta = {
  food: { tags: ['foodie'], groupFit: ['friends', 'couple', 'family', 'alone'] },
  cafe: { tags: ['cafe', 'rest'], groupFit: ['friends', 'couple', 'alone'] },
  tour: { tags: ['nature', 'photo', 'rest'], groupFit: ['friends', 'couple', 'family', 'alone'] },
  photo: { tags: ['photo'], groupFit: ['friends', 'couple', 'alone'] },
  activity: { tags: ['activity', 'shopping'], groupFit: ['friends', 'couple', 'family'] },
}

export const preferenceSearches = {
  cafe: { category: 'cafe', categoryCode: 'CE7', tags: ['cafe', 'rest'] },
  foodie: { category: 'food', categoryCode: 'FD6', tags: ['foodie'] },
  tour: { category: 'tour', categoryCode: 'AT4', tags: ['nature', 'photo', 'rest'] },
  photo: { category: 'photo', keyword: '사진 명소', tags: ['photo'] },
  nature: { category: 'tour', keyword: '공원', tags: ['nature', 'photo', 'rest'] },
  activity: { category: 'activity', categoryCode: 'CT1', tags: ['activity'] },
  shopping: { category: 'activity', keyword: '쇼핑몰', tags: ['shopping'] },
  rest: { category: 'tour', keyword: '산책로', tags: ['rest', 'nature'] },
}

export function estimatedVisitCost(category, id) {
  const hash = [...String(id)].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0)
  const ranges = { food: [12_000, 38_000], cafe: [4_500, 13_000], tour: [0, 9_000], photo: [0, 12_000], activity: [8_000, 45_000] }
  const [minimum, maximum] = ranges[category] || [0, 10_000]
  return Math.round((minimum + ((hash % 1000) / 1000) * (maximum - minimum)) / 1000) * 1000
}

export function requestedSearchProfiles(category, tags) {
  if (category) {
    const profile = Object.values(preferenceSearches).find((item) => item.category === category)
    return profile ? [profile] : []
  }
  const selected = tags.map((tag) => preferenceSearches[tag]).filter(Boolean)
  const unique = [...new Map(selected.map((profile) => [`${profile.category}:${profile.keyword || profile.categoryCode}`, profile])).values()]
  return unique.length
    ? unique
    : [...searchableCategories].map((item) => ({ category: item, categoryCode: kakaoCategoryCodes[item], tags: livePlaceMeta[item]?.tags || [] }))
}

export function toPlace(item, category, origin, tags, distanceKm) {
  const metadata = livePlaceMeta[category] || livePlaceMeta.tour
  return {
    id: `kakao-${item.id}`,
    name: item.place_name,
    area: item.road_address_name || item.address_name || '서울',
    category: category || 'tour',
    lat: Number(item.y),
    lng: Number(item.x),
    tags: tags || metadata.tags,
    groupFit: metadata.groupFit,
    indoor: category !== 'tour' && category !== 'photo',
    estimatedCost: estimatedVisitCost(category, item.id),
    durationMin: category === 'food' ? 70 : 60,
    rating: 0,
    operatingStatus: 'unknown',
    description: item.category_name || item.place_name,
    image: '',
    accent: '#1d9b77',
    distanceKm: distanceKm(origin.lat, origin.lng, Number(item.y), Number(item.x)),
    phone: item.phone || '',
    placeUrl: item.place_url || '',
  }
}
