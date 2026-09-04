import { createServer } from 'node:http'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addFriend, authenticatePasswordUser, changePassword, createPasswordUser, createPlaceReview, createRelationshipRequest, createTrip, deleteFavorite, deletePlaceReview, deleteTrip, deleteUser, ensureConfiguredAdmin, getPlaceReviewSummaries, getPublicTrip, getTrip, initializeDatabase, isAdminUser, listCourses, listFavorites, listFriends, listNotifications, listOtherUsers, listReviews, listUserReviews, listUsers, respondToRelationshipRequest, searchSeoulAreas, siteId, updatePlaceReview, updateTrip, updateUserProfile, upsertFavorite, upsertGoogleUser } from './database.mjs'
import { createGoogleAuthorizationUrl, fetchGoogleProfile } from './oauth.mjs'
import { allowedOrigin, allowedOrigins, createRateLimiter, requestIp } from './security.mjs'
import { estimateBudget } from './services/budget-service.mjs'
import { buildItineraries } from './services/itinerary-service.mjs'
import { kakaoCategoryCodes, livePlaceMeta, preferenceSearches, requestedSearchProfiles, searchableCategories, toPlace } from './services/place-service.mjs'
import { recommendPlaces } from './services/recommendation-service.mjs'
import { optimizePlaces, routeMinutes } from './services/route-service.mjs'

const staticRoot = resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}
const configuredPort = Number(process.env.PORT || 3001)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001
const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '')
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY?.trim() || ''
const kakaoMobilityRestApiKey = process.env.KAKAO_MOBILITY_REST_API_KEY?.trim() || ''
const odsayApiKey = process.env.ODSAY_API_KEY?.trim() || ''
const cacheTtlMs = 3 * 60 * 1000
const placesCache = new Map()
const routesCache = new Map()
const placesCacheMaxEntries = 250
const routesCacheMaxEntries = 100
const maxReviewImageDataUrlLength = 520_000
const maxReviewRequestBytes = 550_000
// Keep tokens valid across server restarts when a deployment has not yet set a
// dedicated secret. DATABASE_URL is required and remains server-only; production
// deployments should still provide AUTH_TOKEN_SECRET explicitly.
const authSecret = process.env.AUTH_TOKEN_SECRET || createHash('sha256').update(process.env.DATABASE_URL || '').digest('base64url')
// Keep the production frontend available even if the hosting environment has
// not yet populated FRONTEND_URL. Additional origins remain opt-in through the
// comma-separated FRONTEND_URL setting.
const corsOrigins = allowedOrigins({ frontendUrl: process.env.FRONTEND_URL || 'https://where-silk.vercel.app' })
const rateLimiter = createRateLimiter()
const kakaoCategoryKeywords = { food: '맛집', cafe: '카페', tour: '관광명소', photo: '사진 명소', activity: '놀거리' }
const allowedTags = new Set(['cafe', 'foodie', 'photo', 'nature', 'activity', 'shopping', 'rest', 'sea', 'crowded', 'noraebang', 'pub', 'sashimi'])
const seoulDistrictCenters = {
  강남구: [37.5172, 127.0473], 강동구: [37.5301, 127.1238], 강북구: [37.6396, 127.0257], 강서구: [37.5509, 126.8495], 관악구: [37.4784, 126.9516], 광진구: [37.5385, 127.0823], 구로구: [37.4954, 126.8874], 금천구: [37.4569, 126.8955], 노원구: [37.6542, 127.0568], 도봉구: [37.6688, 127.0471], 동대문구: [37.5744, 127.0396], 동작구: [37.5124, 126.9393], 마포구: [37.5663, 126.9019], 서대문구: [37.5791, 126.9368], 서초구: [37.4837, 127.0324], 성동구: [37.5633, 127.0371], 성북구: [37.5894, 127.0167], 송파구: [37.5145, 127.1059], 양천구: [37.5170, 126.8664], 영등포구: [37.5264, 126.8962], 용산구: [37.5326, 126.9906], 은평구: [37.6027, 126.9291], 종로구: [37.5735, 126.9788], 중구: [37.5641, 126.9979], 중랑구: [37.6063, 127.0927],
}
const seoulDistrictNames = new Set(Object.keys(seoulDistrictCenters))

function sendJson(response, status, body) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
  if (response.corsOrigin) { headers['Access-Control-Allow-Origin'] = response.corsOrigin; headers.Vary = 'Origin' }
  response.writeHead(status, headers)
  response.end(JSON.stringify(body))
}

function isRateLimited(request, url) {
  const routes = [
    [request.method === 'POST' && url.pathname === '/api/auth/login', 5, 15 * 60_000],
    [request.method === 'POST' && url.pathname === '/api/auth/signup', 5, 60 * 60_000],
    [request.method === 'POST' && /^\/api\/places\/[^/]+\/reviews$/.test(url.pathname), 10, 60_000],
    [request.method === 'POST' && url.pathname === '/api/favorites', 40, 60_000],
    [request.method === 'POST' && url.pathname === '/api/trips', 20, 60_000],
  ]
  const route = routes.find(([matches]) => matches)
  if (!route) return null
  const [, limit, windowMs] = route
  return rateLimiter({ key: `${requestIp(request)}:${request.method}:${url.pathname.replace(/\/[^/]+$/, '')}`, limit, windowMs })
}

function redirect(response, location, cookies = []) {
  const headers = { Location: location }
  if (cookies.length) headers['Set-Cookie'] = cookies
  response.writeHead(302, headers)
  response.end()
}

function requestOrigin(request) {
  if (process.env.API_BASE_URL?.trim()) return process.env.API_BASE_URL.trim().replace(/\/$/, '')
  const forwardedProtocol = request.headers['x-forwarded-proto']
  const protocol = typeof forwardedProtocol === 'string' ? forwardedProtocol.split(',')[0] : 'http'
  return `${protocol}://${request.headers.host || `localhost:${port}`}`
}

function oauthCallbackUri(request) {
  return `${requestOrigin(request)}/api/auth/oauth/google/callback`
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').filter(Boolean).map((item) => {
    const [key, ...value] = item.trim().split('=')
    return [key, decodeURIComponent(value.join('='))]
  }))
}

function oauthStateCookie(value, request, maxAge = 600) {
  const secure = requestOrigin(request).startsWith('https://') ? '; Secure' : ''
  return `where_oauth_state=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/api/auth/oauth/google/callback; HttpOnly; SameSite=Lax${secure}`
}

function frontendOAuthRedirect(response, { user, token, error }, cookies = []) {
  const fragment = user
    ? `oauth_user=${Buffer.from(JSON.stringify(user)).toString('base64url')}&oauth_token=${encodeURIComponent(token || '')}`
    : `oauth_error=${encodeURIComponent(error || '소셜 로그인을 완료하지 못했습니다.')}`
  redirect(response, `${frontendUrl}/#${fragment}`, cookies)
}

async function startGoogleOAuth(request, response) {
  try {
    const state = randomBytes(32).toString('base64url')
    const location = createGoogleAuthorizationUrl({
      redirectUri: oauthCallbackUri(request),
      state,
    })
    redirect(response, location, [oauthStateCookie(state, request)])
  } catch (error) {
    const message = error instanceof Error && error.message === 'OAUTH_PROVIDER_NOT_CONFIGURED'
      ? 'Google 로그인 키가 설정되지 않았습니다.'
      : '소셜 로그인을 시작하지 못했습니다.'
    frontendOAuthRedirect(response, { error: message })
  }
}

async function completeGoogleOAuth(request, response, url) {
  const clearedCookie = oauthStateCookie('', request, 0)
  try {
    if (url.searchParams.has('error')) throw new Error('OAUTH_ACCESS_DENIED')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const savedState = parseCookies(request).where_oauth_state
    if (!code || !state || !savedState || state !== savedState) throw new Error('OAUTH_STATE_INVALID')

    const profile = await fetchGoogleProfile(code, oauthCallbackUri(request))
    const user = await upsertGoogleUser(profile)
    frontendOAuthRedirect(response, { user, token: createAuthToken(user.id) }, [clearedCookie])
  } catch (error) {
    console.error('Google OAuth callback failed:', error instanceof Error ? error.message : 'UNKNOWN_ERROR')
    const message = error instanceof Error && error.message === 'OAUTH_ACCESS_DENIED'
      ? '로그인 동의가 취소됐습니다.'
      : '소셜 로그인을 완료하지 못했습니다.'
    frontendOAuthRedirect(response, { error: message }, [clearedCookie])
  }
}

function fromCache(cache, key) {
  const hit = cache.get(key)
  if (!hit || hit.expiresAt <= Date.now()) {
    cache.delete(key)
    return null
  }
  // Refresh its insertion order so the Map behaves as a small LRU cache.
  cache.delete(key)
  cache.set(key, hit)
  return hit.value
}

function cacheValue(cache, key, value, maxEntries) {
  const now = Date.now()
  for (const [cachedKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(cachedKey)
  }
  while (cache.size >= maxEntries) cache.delete(cache.keys().next().value)
  cache.set(key, { value, expiresAt: Date.now() + cacheTtlMs })
  return value
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const radians = (value) => value * Math.PI / 180
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function createAuthToken(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 14 })).toString('base64url')
  const signature = createHmac('sha256', authSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function authenticatedUserId(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token || !token.includes('.')) return null
  const [payload, signature] = token.split('.')
  const expected = createHmac('sha256', authSecret).update(payload).digest('base64url')
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); return data.exp > Date.now() && typeof data.sub === 'string' ? data.sub : null } catch { return null }
}

function favoriteInput(input) {
  const placeId = typeof input?.placeId === 'string' ? input.placeId.trim() : ''
  const placeName = typeof input?.placeName === 'string' ? input.placeName.trim() : ''
  if (!placeId || placeId.length > 255 || !placeName || placeName.length > 255) return { error: '장소 정보를 확인해 주세요.' }
  const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null
  const latitude = numberOrNull(input.latitude)
  const longitude = numberOrNull(input.longitude)
  if ((latitude !== null && (latitude < -90 || latitude > 90)) || (longitude !== null && (longitude < -180 || longitude > 180))) return { error: '장소 좌표를 확인해 주세요.' }
  return {
    value: {
      placeId,
      placeName,
      address: typeof input.address === 'string' ? input.address.slice(0, 2_000) : '',
      category: typeof input.category === 'string' ? input.category.slice(0, 100) : 'tour',
      imageUrl: typeof input.imageUrl === 'string' ? input.imageUrl.slice(0, 4_000) : '',
      latitude,
      longitude,
      placeData: input.place && typeof input.place === 'object' && !Array.isArray(input.place) ? input.place : {},
    },
  }
}

async function kakaoFetch(url, options, attempts = 2) {
  let lastError
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) })
      if (response.ok || (response.status < 500 && response.status !== 429)) return response
      lastError = new Error(`KAKAO_${response.status}`)
    } catch (error) { lastError = error }
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw lastError || new Error('KAKAO_UNAVAILABLE')
}

function tripInput(input) {
  const text = (value, max = 255) => typeof value === 'string' ? value.trim().slice(0, max) : ''
  const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : fallback
  const coordinate = (value, min, max) => Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max ? Number(value) : null
  const title = text(input?.title, 120)
  const stops = Array.isArray(input?.stops) ? input.stops : []
  if (!title || stops.length === 0 || stops.length > 60) return { error: '코스 제목과 장소 목록을 확인해주세요.' }
  const normalizedStops = []
  for (const stop of stops) {
    const placeName = text(stop?.placeName, 255)
    const latitude = coordinate(stop?.latitude, -90, 90)
    const longitude = coordinate(stop?.longitude, -180, 180)
    if (!placeName || latitude === null || longitude === null) return { error: '코스 장소 정보를 확인해주세요.' }
    normalizedStops.push({
      placeId: text(stop.placeId, 255), placeName, category: text(stop.category, 100) || 'tour', area: text(stop.area, 2_000),
      latitude, longitude, estimatedCost: integer(stop.estimatedCost), durationMin: integer(stop.durationMin),
      metadata: stop.metadata && typeof stop.metadata === 'object' && !Array.isArray(stop.metadata) ? stop.metadata : {},
    })
  }
  const companion = ['friends', 'couple', 'family', 'alone'].includes(input?.companion) ? input.companion : 'alone'
  const transport = ['public', 'car'].includes(input?.transport) ? input.transport : 'public'
  const weather = ['sunny', 'cloudy', 'rain'].includes(input?.weather) ? input.weather : 'sunny'
  const list = (value) => Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 30) : []
  return { value: {
    title, description: text(input?.description, 4_000), startArea: text(input?.startArea, 255),
    dateStart: /^\d{4}-\d{2}-\d{2}$/.test(input?.dateStart || '') ? input.dateStart : null,
    dateEnd: /^\d{4}-\d{2}-\d{2}$/.test(input?.dateEnd || '') ? input.dateEnd : null,
    companion, headcount: Math.min(100, Math.max(1, integer(input?.headcount, 1))), budgetPerPerson: integer(input?.budgetPerPerson),
    transport, weather, likes: list(input?.likes), dislikes: list(input?.dislikes),
    routeCoordinates: Array.isArray(input?.routeCoordinates) ? input.routeCoordinates.slice(0, 100) : [],
    isPublic: input?.isPublic === true, stops: normalizedStops,
  } }
}

function kakaoPlaceToPlace(item, category, origin, tags) {
  return toPlace(item, category, origin, tags, (lat1, lng1, lat2, lng2) => Number(haversineKm(lat1, lng1, lat2, lng2).toFixed(2)))
}

function searchBounds(url) {
  const south = Number(url.searchParams.get('south'))
  const north = Number(url.searchParams.get('north'))
  const west = Number(url.searchParams.get('west'))
  const east = Number(url.searchParams.get('east'))
  return Number.isFinite(south) && Number.isFinite(north) && Number.isFinite(west) && Number.isFinite(east)
    && south < north && west < east
    ? { south, north, west, east }
    : null
}

function isInBounds(place, bounds) {
  return !bounds || (place.lat >= bounds.south && place.lat <= bounds.north && place.lng >= bounds.west && place.lng <= bounds.east)
}

async function searchKakaoPlaces(url, category, keyword, area, companion, limit, page, origin, bounds, tags) {
  if (!kakaoRestApiKey) throw new Error('KAKAO_PLACES_NOT_CONFIGURED')
  const selectedDistrict = seoulDistrictNames.has(area)
  const searchKeyword = keyword
  const districtCenter = selectedDistrict ? seoulDistrictCenters[area] : null
  const searchCenter = districtCenter ? { lat: districtCenter[0], lng: districtCenter[1] } : origin
  // "전체"는 동행 유형으로 좁히지 않고, 모든 화면 카테고리를 함께 검색한다.
  // 각 카카오 응답에 카테고리를 보존해 지도 핀을 장소 유형별로 구분한다.
  const profiles = requestedSearchProfiles(category, tags)
  const perCategoryLimit = Math.min(15, Math.max(3, Math.ceil(limit / profiles.length) + 3))
  const radius = String(Math.min(Number(url.searchParams.get('radius') || 8000), 20000))
  const headers = { Authorization: `KakaoAK ${kakaoRestApiKey}` }
  const requestDocuments = async (profile, query) => {
    const endpoint = query ? 'https://dapi.kakao.com/v2/local/search/keyword.json' : 'https://dapi.kakao.com/v2/local/search/category.json'
    const params = new URLSearchParams({ size: String(perCategoryLimit), page: String(page), x: String(searchCenter.lng), y: String(searchCenter.lat), radius, ...(query ? { query } : { category_group_code: profile.categoryCode || kakaoCategoryCodes[profile.category] }) })
    const response = await kakaoFetch(`${endpoint}?${params}`, { headers })
    if (!response.ok) throw new Error(`KAKAO_PLACES_${response.status}`)
    const payload = await response.json()
    return { documents: payload.documents || [], isEnd: Boolean(payload.meta?.is_end) }
  }
  const responses = await Promise.all(profiles.map(async (profile) => {
    try {
      const query = searchKeyword || profile.keyword ? `${area || '서울'} ${searchKeyword || profile.keyword}` : ''
      let { documents, isEnd } = await requestDocuments(profile, query)
      if (selectedDistrict) documents = documents.filter((item) => `${item.address_name || ''} ${item.road_address_name || ''}`.includes(area))
      // A category response can use a shortened address and be filtered out even
      // though Kakao has results in the selected district. Retry that one profile
      // with an explicit district keyword before treating it as an empty result.
      if (selectedDistrict && documents.length === 0 && !query) {
        const fallback = await requestDocuments(profile, `${area} ${kakaoCategoryKeywords[profile.category] || profile.category}`)
        documents = fallback.documents.filter((item) => `${item.address_name || ''} ${item.road_address_name || ''}`.includes(area))
        isEnd = fallback.isEnd
      }
      return { places: documents.map((item) => kakaoPlaceToPlace(item, profile.category, origin, profile.tags)), isEnd, failed: false }
    } catch (error) {
      console.warn('Kakao category search failed:', profile.category, error instanceof Error ? error.message : 'UNKNOWN_ERROR')
      // One failed Kakao category must not hide successful results from the others.
      return { places: [], isEnd: true, failed: true }
    }
  }))
  if (responses.every((response) => response.failed)) throw new Error('KAKAO_PLACES_UNAVAILABLE')
  const data = [...new Map(responses.flatMap((response) => response.places).map((place) => [place.id, place])).values()]
    .filter((place) => isInBounds(place, bounds))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
  return { data, meta: { total: data.length, area: area || '서울', category: category || 'all', source: 'kakao', page, hasMore: responses.some((response) => !response.isEnd) } }
}

async function findPlaces(url) {
  const area = url.searchParams.get('area')?.trim() ?? ''
  const category = url.searchParams.get('category')?.trim() ?? ''
  const companion = url.searchParams.get('companion')?.trim() ?? ''
  const keyword = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const tags = (url.searchParams.get('tags') || '').split(',').map((tag) => tag.trim()).filter((tag) => Object.hasOwn(preferenceSearches, tag))
  const requestedLimit = Number(url.searchParams.get('limit') ?? 24)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 40)) : 24
  const requestedPage = Number(url.searchParams.get('page') ?? 1)
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(Math.floor(requestedPage), 45)) : 1

  if (category && !searchableCategories.has(category)) {
    return { error: 'category must be food, cafe, tour, photo, or activity' }
  }
  if (!seoulDistrictNames.has(area)) {
    return { error: 'area must be one of Seoul\'s 25 districts' }
  }
  const origin = { lat: Number(url.searchParams.get('lat')) || 37.5668, lng: Number(url.searchParams.get('lng')) || 126.978 }
  const bounds = searchBounds(url)
  const cacheKey = JSON.stringify({ area, category, companion, keyword, tags, limit, page, lat: origin.lat.toFixed(4), lng: origin.lng.toFixed(4), radius: url.searchParams.get('radius') || '', bounds, zoom: url.searchParams.get('zoom') || '' })
  const cached = fromCache(placesCache, cacheKey)
  try {
    const result = cached || cacheValue(placesCache, cacheKey, await searchKakaoPlaces(url, category, keyword, area, companion, limit, page, origin, bounds, tags), placesCacheMaxEntries)
    const summaries = await getPlaceReviewSummaries(result.data.map((place) => place.id))
    const summaryByPlace = new Map(summaries.map((summary) => [summary.placeId, summary]))
    return { ...result, data: result.data.map((place) => ({ ...place, ...(summaryByPlace.get(place.id) || { rating: 0, reviewCount: 0 }) })) }
  } catch (error) {
    console.error('Kakao place search failed:', error instanceof Error ? error.message : 'UNKNOWN_ERROR')
    return { error: 'KAKAO_PLACES_UNAVAILABLE', status: 502 }
  }
}

function validPoint(value) {
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
    && value.lat >= -90 && value.lat <= 90 && value.lng >= -180 && value.lng <= 180
}

function routeCoordinates(payload) {
  const roads = payload.routes?.[0]?.sections?.flatMap((section) => section.roads || []) || []
  return roads.flatMap((road) => {
    const vertices = road.vertexes || []
    const points = []
    for (let index = 0; index < vertices.length; index += 2) points.push({ lng: vertices[index], lat: vertices[index + 1] })
    return points
  })
}

function straightLineCoordinates(origin, stops) { return [origin, ...stops].map(({ lat, lng }) => ({ lat, lng })) }

function routeFallback(origin, stops, transport, reason = 'HAVERSINE_ESTIMATE') {
  const distanceMeters = Math.round([origin, ...stops].slice(1).reduce((total, stop, index) => total + haversineKm((index ? stops[index - 1] : origin).lat, (index ? stops[index - 1] : origin).lng, stop.lat, stop.lng), 0) * 1000)
  const kmh = transport === 'walk' ? 4.5 : transport === 'public' ? 18 : 32
  const durationSeconds = Math.max(60, Math.round((distanceMeters / 1000) / kmh * 3600))
  const fare = transport === 'public' ? Math.max(1_250, 1_250 + Math.max(0, Math.ceil((distanceMeters - 10_000) / 5_000)) * 100) : 0
  return { data: { coordinates: straightLineCoordinates(origin, stops), distanceMeters, durationSeconds, summary: { fare, estimated: true, reason } } }
}

async function fetchOdsayRoute(origin, destination) {
  if (!odsayApiKey) throw new Error('ODSAY_NOT_CONFIGURED')
  const params = new URLSearchParams({ SX: String(origin.lng), SY: String(origin.lat), EX: String(destination.lng), EY: String(destination.lat), apiKey: odsayApiKey })
  const response = await fetch(`https://api.odsay.com/v1/api/searchPubTransPathT?${params}`, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`ODSAY_${response.status}`)
  const payload = await response.json(); const info = payload.result?.path?.[0]?.info
  if (!info || !Number.isFinite(Number(info.totalTime))) throw new Error('ODSAY_EMPTY')
  return { distanceMeters: Math.round(Number(info.totalDistance || 0)), durationSeconds: Math.round(Number(info.totalTime) * 60), fare: Math.max(0, Number(info.payment || 0)) }
}

async function findPublicRoute(origin, stops) {
  try {
    let distanceMeters = 0; let durationSeconds = 0; let fare = 0; let previous = origin
    for (const stop of stops) { const leg = await fetchOdsayRoute(previous, stop); distanceMeters += leg.distanceMeters; durationSeconds += leg.durationSeconds; fare += leg.fare; previous = stop }
    return { data: { coordinates: straightLineCoordinates(origin, stops), distanceMeters, durationSeconds, summary: { fare, provider: 'odsay' } } }
  } catch (error) { console.warn('Public transit route fallback:', error instanceof Error ? error.message : 'UNKNOWN_ERROR'); return routeFallback(origin, stops, 'public') }
}

async function findWalkingRoute(origin, stops) {
  const coordinates = [origin, ...stops].map(({ lng, lat }) => `${lng},${lat}`).join(';')
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/foot/${coordinates}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`OSRM_${response.status}`)
    const payload = await response.json(); const route = payload.routes?.[0]
    if (!route || !Array.isArray(route.geometry?.coordinates)) throw new Error('OSRM_EMPTY')
    return { data: { coordinates: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })), distanceMeters: Math.round(route.distance), durationSeconds: Math.round(route.duration), summary: { fare: 0, provider: 'osrm' } } }
  } catch (error) { console.warn('Walking route fallback:', error instanceof Error ? error.message : 'UNKNOWN_ERROR'); return routeFallback(origin, stops, 'walk') }
}

async function findRoute(input) {
  const origin = input?.origin
  const stops = Array.isArray(input?.stops) ? input.stops.slice(0, 5) : []
  if (!validPoint(origin) || stops.length === 0 || !stops.every(validPoint)) return { error: 'INVALID_ROUTE_POINTS', status: 400 }
  const transport = ['car', 'public', 'walk'].includes(input.transport) ? input.transport : 'car'

  const cacheKey = JSON.stringify({ origin, stops, transport })
  const cached = fromCache(routesCache, cacheKey)
  if (cached) return cached
  if (transport === 'public') return cacheValue(routesCache, cacheKey, await findPublicRoute(origin, stops), routesCacheMaxEntries)
  if (transport === 'walk') return cacheValue(routesCache, cacheKey, await findWalkingRoute(origin, stops), routesCacheMaxEntries)
  if (!kakaoMobilityRestApiKey) return { error: 'KAKAO_MOBILITY_NOT_CONFIGURED', status: 503 }
  const destination = stops.at(-1)
  try {
    const routes = []
    for (const priority of ['RECOMMEND', 'TIME', 'SHORTEST']) {
      const params = new URLSearchParams({ origin: `${origin.lng},${origin.lat}`, destination: `${destination.lng},${destination.lat}`, priority, summary: 'false' })
      if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map((stop) => `${stop.lng},${stop.lat}`).join('|'))
      const response = await kakaoFetch(`https://apis-navi.kakaomobility.com/v1/directions?${params}`, { headers: { Authorization: `KakaoAK ${kakaoMobilityRestApiKey}` } })
      if (!response.ok) throw new Error(`KAKAO_ROUTE_${response.status}`)
      const payload = await response.json(); const summary = payload.routes?.[0]?.summary; const coordinates = routeCoordinates(payload)
      if (!summary || coordinates.length < 2) throw new Error('KAKAO_ROUTE_EMPTY')
      routes.push({ priority, coordinates, distanceMeters: summary.distance, durationSeconds: summary.duration, summary: { fare: Number(summary.fare || 0), provider: 'kakao' } })
    }
    const [primary, ...alternatives] = routes
    return cacheValue(routesCache, cacheKey, { data: { ...primary, alternatives } }, routesCacheMaxEntries)
  } catch (error) {
    console.error('Kakao route search failed:', error instanceof Error ? error.message : 'UNKNOWN_ERROR')
    return { error: 'KAKAO_ROUTE_UNAVAILABLE', status: 502 }
  }
}

function optimizeInput(input) {
  const places = Array.isArray(input?.places) ? input.places.slice(0, 30) : []; const start = input?.start
  const transport = ['car', 'public', 'walk'].includes(input?.transport) ? input.transport : 'public'
  if (!validPoint(start) || places.length === 0) return { error: 'INVALID_OPTIMIZE_INPUT' }
  const normalized = places.map((place, index) => ({ ...place, lat: Number(place?.lat ?? place?.latitude), lng: Number(place?.lng ?? place?.longitude), durationMin: Math.max(0, Number(place?.durationMin) || 0), _index: index }))
  return normalized.every(validPoint) ? { value: { start, places: normalized, transport } } : { error: 'INVALID_OPTIMIZE_POINTS' }
}
async function optimizeRoute(input) {
  const validation = optimizeInput(input); if ('error' in validation) return { ...validation, status: 400 }
  const { start, places, transport } = validation.value; const ordered = optimizePlaces(start, places, transport); const route = await findRoute({ origin: start, stops: ordered, transport })
  const totalTravelMinutes = 'data' in route ? Math.max(1, Math.round(route.data.durationSeconds / 60)) : Math.round(routeMinutes(start, ordered, transport)); const totalPlayMinutes = ordered.reduce((total, place) => total + place.durationMin, 0); const transportCost = 'data' in route ? Number(route.data.summary?.fare || 0) : 0
  return { data: { places: ordered.map(({ _index, ...place }) => place), order: ordered.map((place) => place._index), totalPlayMinutes, totalTravelMinutes, playTimeRatio: totalPlayMinutes ? totalPlayMinutes / (totalPlayMinutes + totalTravelMinutes) : 0, transportCost, route: 'data' in route ? route.data : null } }
}

function travelConditions(input) {
  const value = input?.conditions
  if (!value || !seoulDistrictNames.has(value.start) || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateStart || '') || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateEnd || '') || value.dateEnd < value.dateStart) return { error: 'INVALID_TRAVEL_CONDITIONS' }
  const companion = ['friends', 'couple', 'family', 'alone'].includes(value.companion) ? value.companion : 'alone'
  const transport = ['public', 'car'].includes(value.transport) ? value.transport : 'public'
  const weather = ['sunny', 'cloudy', 'rain'].includes(value.weather) ? value.weather : 'cloudy'
  const list = (items) => Array.isArray(items) ? items.filter((item) => typeof item === 'string' && allowedTags.has(item)).slice(0, 20) : []
  return { value: {
    start: value.start,
    dateStart: value.dateStart,
    dateEnd: value.dateEnd,
    companion,
    headcount: Math.max(1, Math.min(100, Math.floor(Number(value.headcount) || 1))),
    budgetPerPerson: Math.max(0, Math.min(10_000_000, Math.floor(Number(value.budgetPerPerson) || 0))),
    transport,
    weather,
    likes: list(value.likes),
    dislikes: list(value.dislikes),
  } }
}

async function createTravelPlan(input) {
  const validation = travelConditions(input)
  if ('error' in validation) return { ...validation, status: 400 }
  const conditions = validation.value
  const search = input?.search && typeof input.search === 'object' ? input.search : {}
  const origin = validPoint(search.origin) ? search.origin : { lat: 37.5668, lng: 126.978 }
  const url = new URL('http://internal/api/places')
  url.searchParams.set('area', conditions.start)
  url.searchParams.set('companion', conditions.companion)
  url.searchParams.set('lat', String(origin.lat))
  url.searchParams.set('lng', String(origin.lng))
  url.searchParams.set('radius', String(Math.max(100, Math.min(20_000, Number(search.radius) || 6_000))))
  url.searchParams.set('page', String(Math.max(1, Math.min(45, Math.floor(Number(search.page) || 1)))))
  url.searchParams.set('limit', String(Math.max(1, Math.min(40, Math.floor(Number(search.limit) || 20)))))
  if (typeof search.query === 'string' && search.query.trim()) url.searchParams.set('q', search.query.trim())
  const themes = Array.isArray(search.themes) ? search.themes.filter((theme) => Object.hasOwn(preferenceSearches, theme)) : conditions.likes
  if (themes.length) url.searchParams.set('tags', themes.join(','))
  const result = await findPlaces(url)
  if ('error' in result) return result
  const excludedIds = Array.isArray(input?.excludedPlaceIds) ? input.excludedPlaceIds.filter((id) => typeof id === 'string').slice(0, 100) : []
  const seed = Number.isFinite(Number(input?.seed)) ? Number(input.seed) : 0
  const recommendations = recommendPlaces(result.data, { ...conditions, likes: themes }, excludedIds, seed)
  const days = Math.max(1, Math.min(3, Math.round((new Date(conditions.dateEnd).getTime() - new Date(conditions.dateStart).getTime()) / 86400000) + 1))
  const itineraries = buildItineraries(recommendations, { ...conditions, likes: themes }, days, origin)
  const budget = estimateBudget(conditions, itineraries.flat().map((stop) => stop.place))
  return { data: { recommendations, itineraries, budget }, meta: result.meta }
}

function recalculateBudget(input) {
  const validation = travelConditions(input)
  if ('error' in validation) return { ...validation, status: 400 }
  const places = Array.isArray(input?.places) ? input.places.filter((place) => place && place.category !== 'lodging').slice(0, 60) : []
  return { data: estimateBudget(validation.value, places, Number.isFinite(Number(input?.transportCost)) ? Number(input.transportCost) : undefined) }
}

async function readJsonBody(request, maxBytes = 16_384) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function validatePassword(password) {
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) return { error: 'Password must contain letters and numbers and be 8 to 128 characters long.' }
  return { value: password }
}

function validateSignup(input) {
  const name = typeof input.name === 'string' ? input.name.trim().normalize('NFC') : ''
  const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  if (name.length < 2 || name.length > 20) return { error: '닉네임은 2~20자로 입력해 주세요.' }
  if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) return { error: '아이디는 영문, 숫자, 밑줄 4~20자로 입력해 주세요.' }
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)) return { error: '비밀번호는 영문과 숫자를 섞어 8~128자로 입력해 주세요.' }
  return { value: { name, username, password } }
}

function validateProfile(input) {
  const name = typeof input.name === 'string' ? input.name.trim().normalize('NFC') : ''
  const profileImage = typeof input.profileImage === 'string' ? input.profileImage : ''
  if (name.length < 2 || name.length > 20) return { error: 'Name must be 2 to 20 characters long.' }
  if (profileImage.length > 7_100_000) return { error: 'Profile image is too large.' }
  if (profileImage && !/^https:\/\/.+/.test(profileImage) && !/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(profileImage)) {
    return { error: 'Profile image must be a JPG or PNG image.' }
  }
  return { value: { name, profileImage } }
}

async function serveStatic(url, response) {
  const requestedPath = decodeURIComponent(url.pathname)
  const relativePath = requestedPath === '/' ? '/index.html' : requestedPath
  const candidate = resolve(staticRoot, `.${relativePath}`)
  if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}${sep}`)) return false

  let filePath = candidate
  try {
    await readFile(filePath)
  } catch {
    if (extname(relativePath)) return false
    filePath = resolve(staticRoot, 'index.html')
  }

  const body = await readFile(filePath)
  response.writeHead(200, {
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
  })
  response.end(body)
  return true
}

await initializeDatabase()
await ensureConfiguredAdmin()

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost:3001')
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : ''
  response.corsOrigin = allowedOrigin(origin, corsOrigins)
  if (origin && !response.corsOrigin) return sendJson(response, 403, { error: 'CORS_ORIGIN_NOT_ALLOWED' })
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})
  const rate = isRateLimited(request, url)
  if (rate && !rate.allowed) {
    response.setHeader('Retry-After', String(rate.retryAfterSeconds))
    return sendJson(response, 429, { error: 'RATE_LIMITED', retryAfterSeconds: rate.retryAfterSeconds })
  }
  if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true, database: 'postgresql', siteId })
  if (request.method === 'GET' && url.pathname === '/api/areas') {
    const query = url.searchParams.get('q') || ''
    const limit = url.searchParams.get('limit') || '8'
    return sendJson(response, 200, { data: await searchSeoulAreas(query, limit) })
  }
  if (request.method === 'GET' && url.pathname === '/api/courses') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    const result = await listCourses({ userId, page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return sendJson(response, 200, { ...result, pagination: { ...result.pagination, totalPages: Math.ceil(result.pagination.total / result.pagination.limit) } })
  }
  if (request.method === 'GET' && /^\/api\/share\/trips\/[^/]+$/.test(url.pathname)) {
    const shareToken = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim()
    const trip = shareToken ? await getPublicTrip(shareToken) : null
    return trip ? sendJson(response, 200, { data: trip }) : sendJson(response, 404, { error: '공개 코스를 찾을 수 없습니다.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/trips') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    const result = await listCourses({ userId, page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return sendJson(response, 200, { ...result, pagination: { ...result.pagination, totalPages: Math.ceil(result.pagination.total / result.pagination.limit) } })
  }
  if (request.method === 'POST' && url.pathname === '/api/trips') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const validation = tripInput(await readJsonBody(request, 250_000))
      if ('error' in validation) return sendJson(response, 400, validation)
      return sendJson(response, 201, { data: await createTrip({ userId, input: validation.value }) })
    } catch (error) { return sendJson(response, error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: '코스를 저장하지 못했습니다.' }) }
  }
  if (request.method === 'GET' && /^\/api\/trips\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    const trip = await getTrip({ userId, tripId: decodeURIComponent(url.pathname.split('/').at(-1) || '') })
    return trip ? sendJson(response, 200, { data: trip }) : sendJson(response, 404, { error: '코스를 찾을 수 없습니다.' })
  }
  if (request.method === 'PUT' && /^\/api\/trips\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const validation = tripInput(await readJsonBody(request, 250_000))
      if ('error' in validation) return sendJson(response, 400, validation)
      const data = await updateTrip({ userId, tripId: decodeURIComponent(url.pathname.split('/').at(-1) || ''), input: validation.value })
      return sendJson(response, 200, { data })
    } catch (error) { return sendJson(response, error?.code === 'TRIP_NOT_FOUND' ? 404 : error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: '코스를 수정하지 못했습니다.' }) }
  }
  if (request.method === 'DELETE' && /^\/api\/trips\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    const deleted = await deleteTrip({ userId, tripId: decodeURIComponent(url.pathname.split('/').at(-1) || '') })
    return deleted ? sendJson(response, 200, { ok: true }) : sendJson(response, 404, { error: '코스를 찾을 수 없습니다.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/favorites') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    return sendJson(response, 200, { data: await listFavorites(userId) })
  }
  if (request.method === 'POST' && url.pathname === '/api/favorites') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const validation = favoriteInput(await readJsonBody(request, 32_768))
      if ('error' in validation) return sendJson(response, 400, validation)
      return sendJson(response, 201, { data: await upsertFavorite({ userId, ...validation.value }) })
    } catch (error) {
      return sendJson(response, error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: '찜한 장소를 저장하지 못했습니다.' })
    }
  }
  if (request.method === 'DELETE' && /^\/api\/favorites\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    const placeId = decodeURIComponent(url.pathname.split('/').at(-1) || '').trim()
    if (!placeId) return sendJson(response, 400, { error: '장소 정보를 확인해 주세요.' })
    return await deleteFavorite({ userId, placeId })
      ? sendJson(response, 200, { ok: true })
      : sendJson(response, 404, { error: '찜한 장소를 찾을 수 없습니다.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/reviews') {
    const result = await listReviews({ placeId: url.searchParams.get('placeId') || '', page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return sendJson(response, 200, { ...result, pagination: { ...result.pagination, totalPages: Math.ceil(result.pagination.total / result.pagination.limit) } })
  }
  if (request.method === 'GET' && url.pathname === '/api/my/reviews') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: 'LOGIN_REQUIRED' })
    const result = await listUserReviews({ userId, page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return sendJson(response, 200, { ...result, pagination: { ...result.pagination, totalPages: Math.ceil(result.pagination.total / result.pagination.limit) } })
  }
  if (request.method === 'GET' && /^\/api\/places\/[^/]+\/reviews$/.test(url.pathname)) {
    const placeId = decodeURIComponent(url.pathname.split('/')[3])
    const result = await listReviews({ placeId, page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return sendJson(response, 200, result)
  }
  if (request.method === 'POST' && /^\/api\/places\/[^/]+\/reviews$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const input = await readJsonBody(request, maxReviewRequestBytes)
      const content = typeof input.content === 'string' ? input.content.trim() : ''
      const rating = Number(input.rating)
      const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : ''
      const isValidReviewImage = !imageUrl || (imageUrl.length <= maxReviewImageDataUrlLength && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageUrl))
      if (!content && !imageUrl) return sendJson(response, 400, { error: '후기 내용 또는 사진을 첨부해 주세요.' })
      if (content.length > 1000 || !isValidReviewImage || !Number.isInteger(rating) || rating < 1 || rating > 5) return sendJson(response, 400, { error: '후기 내용, 사진, 1~5점 별점을 확인해 주세요.' })
      const placeId = decodeURIComponent(url.pathname.split('/')[3])
      if (!placeName) return sendJson(response, 400, { error: 'INVALID_PLACE_NAME' })
      const review = await createPlaceReview({ userId, placeId, placeName, rating, content, imageUrl })
      const [summary] = await getPlaceReviewSummaries([placeId])
      return sendJson(response, 201, { data: { ...review, summary: summary || { placeId, rating, reviewCount: 1 } } })
    } catch (error) {
      return sendJson(response, error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? '첨부 사진 용량이 너무 큽니다. 다른 사진을 선택해 주세요.' : '후기를 등록하지 못했습니다.' })
    }
  }
  if (request.method === 'PUT' && /^\/api\/reviews\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: 'LOGIN_REQUIRED' })
    try {
      const input = await readJsonBody(request, maxReviewRequestBytes)
      const content = typeof input.content === 'string' ? input.content.trim() : ''
      const rating = Number(input.rating)
      const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : ''
      const placeName = typeof input.placeName === 'string' ? input.placeName.trim().slice(0, 255) : ''
      const isValidReviewImage = !imageUrl || (imageUrl.length <= maxReviewImageDataUrlLength && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(imageUrl))
      if (!content && !imageUrl) return sendJson(response, 400, { error: 'REVIEW_CONTENT_OR_IMAGE_REQUIRED' })
      if (content.length > 1000 || !isValidReviewImage || !Number.isInteger(rating) || rating < 1 || rating > 5) return sendJson(response, 400, { error: 'INVALID_REVIEW_INPUT' })
      const reviewId = decodeURIComponent(url.pathname.split('/').at(-1) || '')
      return sendJson(response, 200, { data: await updatePlaceReview({ reviewId, userId, rating, content, imageUrl }) })
    } catch (error) {
      const status = error?.code === 'REVIEW_FORBIDDEN' ? 403 : error?.code === 'REVIEW_NOT_FOUND' ? 404 : error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 500
      return sendJson(response, status, { error: error?.code || (status === 413 ? 'REQUEST_TOO_LARGE' : 'REVIEW_UPDATE_FAILED') })
    }
  }
  if (request.method === 'DELETE' && /^\/api\/reviews\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try { await deletePlaceReview({ reviewId: url.pathname.split('/').at(-1), userId }); return sendJson(response, 200, { ok: true })
    } catch (error) { return sendJson(response, error?.code === 'REVIEW_FORBIDDEN' ? 403 : error?.code === 'REVIEW_NOT_FOUND' ? 404 : 500, { error: error?.code || 'REVIEW_DELETE_FAILED' }) }
  }
  if (request.method === 'GET' && url.pathname === '/api/auth/oauth/google') return startGoogleOAuth(request, response)
  if (request.method === 'GET' && url.pathname === '/api/auth/oauth/google/callback') return completeGoogleOAuth(request, response, url)
  if (request.method === 'GET' && url.pathname === '/api/social/users') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    return sendJson(response, 200, { data: await listOtherUsers(userId) })
  }
  if (request.method === 'GET' && url.pathname === '/api/admin/users') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    if (!(await isAdminUser(userId))) return sendJson(response, 403, { error: '관리자 권한이 필요합니다.' })
    return sendJson(response, 200, { data: await listUsers() })
  }
  if (request.method === 'DELETE' && /^\/api\/admin\/users\/[^/]+$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    if (!(await isAdminUser(userId))) return sendJson(response, 403, { error: '관리자 권한이 필요합니다.' })
    const targetUserId = decodeURIComponent(url.pathname.split('/').at(-1) || '')
    if (!targetUserId) return sendJson(response, 400, { error: '사용자 정보를 확인해 주세요.' })
    if (targetUserId === userId) return sendJson(response, 400, { error: '관리자 계정은 여기서 삭제할 수 없습니다.' })
    return await deleteUser(targetUserId)
      ? sendJson(response, 200, { ok: true })
      : sendJson(response, 404, { error: '사용자를 찾을 수 없습니다.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/social/friends') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    return sendJson(response, 200, { data: await listFriends(userId) })
  }
  if (request.method === 'GET' && url.pathname === '/api/social/notifications') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    return sendJson(response, 200, { data: await listNotifications(userId) })
  }
  if (request.method === 'POST' && url.pathname === '/api/social/friends') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const { friendId } = await readJsonBody(request)
      if (typeof friendId !== 'string' || !friendId.trim()) return sendJson(response, 400, { error: 'friendId is required' })
      await addFriend(userId, friendId)
      return sendJson(response, 201, { ok: true })
    } catch (error) { return sendJson(response, 400, { error: error instanceof Error ? error.message : 'FRIEND_ADD_FAILED' }) }
  }
  if (request.method === 'POST' && url.pathname === '/api/social/relationship-requests') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const { recipientId, relationshipType } = await readJsonBody(request)
      if (typeof recipientId !== 'string' || !recipientId.trim() || !['friend', 'couple', 'family'].includes(relationshipType)) return sendJson(response, 400, { error: 'invalid relationship request' })
      return sendJson(response, 201, { data: await createRelationshipRequest(userId, recipientId, relationshipType) })
    } catch (error) { return sendJson(response, 400, { error: error instanceof Error ? error.message : 'RELATIONSHIP_REQUEST_FAILED' }) }
  }
  if (request.method === 'POST' && /^\/api\/social\/notifications\/[^/]+\/respond$/.test(url.pathname)) {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const requestId = url.pathname.split('/')[4]
      const { accepted } = await readJsonBody(request)
      if (typeof accepted !== 'boolean') return sendJson(response, 400, { error: 'invalid notification response' })
      return sendJson(response, 200, { data: await respondToRelationshipRequest(userId, requestId, accepted) })
    } catch (error) { return sendJson(response, 400, { error: error instanceof Error ? error.message : 'NOTIFICATION_RESPONSE_FAILED' }) }
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
    try {
      const validation = validateSignup(await readJsonBody(request))
      if ('error' in validation) return sendJson(response, 400, validation)
      const user = await createPasswordUser(validation.value)
      return sendJson(response, 201, { user, token: createAuthToken(user.id) })
    } catch (error) {
      if (error instanceof Error && error.code === 'USERNAME_ALREADY_EXISTS') return sendJson(response, 409, { error: '이미 사용 중인 아이디입니다.' })
      if (error instanceof Error && error.message === 'INVALID_JSON') return sendJson(response, 400, { error: '요청 형식이 올바르지 않습니다.' })
      if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') return sendJson(response, 413, { error: '요청이 너무 큽니다.' })
      return sendJson(response, 500, { error: '회원가입을 처리하지 못했습니다.' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const input = await readJsonBody(request)
      const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : ''
      const password = typeof input.password === 'string' ? input.password : ''
      if (!username || !password) return sendJson(response, 400, { error: 'Username and password are required.' })
      const user = await authenticatePasswordUser({ username, password })
      return sendJson(response, 200, { user, token: createAuthToken(user.id) })
    } catch (error) {
      if (error instanceof Error && error.code === 'INVALID_CREDENTIALS') return sendJson(response, 401, { error: 'Invalid username or password.' })
      if (error instanceof Error && error.message === 'INVALID_JSON') return sendJson(response, 400, { error: 'Invalid request body.' })
      return sendJson(response, 500, { error: 'Unable to sign in.' })
    }
  }
  if (request.method === 'PUT' && url.pathname === '/api/auth/password') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const input = await readJsonBody(request)
      const currentPassword = typeof input.currentPassword === 'string' ? input.currentPassword : ''
      const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''
      const passwordValidation = validatePassword(newPassword)
      if (!currentPassword || 'error' in passwordValidation) return sendJson(response, 400, { error: 'error' in passwordValidation ? passwordValidation.error : 'Current password is required.' })
      return sendJson(response, 200, { user: await changePassword({ userId, currentPassword, newPassword }) })
    } catch (error) {
      if (error instanceof Error && error.code === 'CURRENT_PASSWORD_INVALID') return sendJson(response, 401, { error: 'Current password is incorrect.' })
      if (error instanceof Error && error.code === 'PASSWORD_AUTH_UNAVAILABLE') return sendJson(response, 403, { error: 'Password changes are unavailable for social accounts.' })
      if (error instanceof Error && error.code === 'USER_NOT_FOUND') return sendJson(response, 404, { error: 'User not found.' })
      if (error instanceof Error && error.message === 'INVALID_JSON') return sendJson(response, 400, { error: 'Invalid request body.' })
      return sendJson(response, 500, { error: 'Unable to change password.' })
    }
  }
  if (request.method === 'PUT' && url.pathname === '/api/auth/me') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    try {
      const validation = validateProfile(await readJsonBody(request, 7_200_000))
      if ('error' in validation) return sendJson(response, 400, validation)
      return sendJson(response, 200, { user: await updateUserProfile({ userId, ...validation.value }) })
    } catch (error) {
      if (error instanceof Error && error.code === 'USER_NOT_FOUND') return sendJson(response, 404, { error: 'User not found.' })
      if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') return sendJson(response, 413, { error: 'Profile image is too large.' })
      if (error instanceof Error && error.message === 'INVALID_JSON') return sendJson(response, 400, { error: 'Invalid request body.' })
      return sendJson(response, 500, { error: 'Unable to update profile.' })
    }
  }
  if (request.method === 'DELETE' && url.pathname === '/api/auth/me') {
    const userId = authenticatedUserId(request)
    if (!userId) return sendJson(response, 401, { error: '로그인이 필요합니다.' })
    return await deleteUser(userId)
      ? sendJson(response, 200, { ok: true })
      : sendJson(response, 404, { error: 'User not found.' })
  }
  if (request.method === 'GET' && url.pathname === '/api/places') {
    const result = await findPlaces(url)
    return 'error' in result ? sendJson(response, result.status || 400, { error: result.error }) : sendJson(response, 200, result)
  }
  if (request.method === 'POST' && url.pathname === '/api/travel-plan') {
    try {
      const result = await createTravelPlan(await readJsonBody(request, 96_000))
      return 'error' in result ? sendJson(response, result.status || 400, { error: result.error }) : sendJson(response, 200, result)
    } catch (error) {
      console.error('Travel plan request failed:', error instanceof Error ? error.message : error)
      return sendJson(response, error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: 'TRAVEL_PLAN_REQUEST_FAILED' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/budget') {
    try {
      const result = recalculateBudget(await readJsonBody(request, 96_000))
      return 'error' in result ? sendJson(response, result.status || 400, { error: result.error }) : sendJson(response, 200, result)
    } catch (error) {
      return sendJson(response, error instanceof Error && error.message === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: 'BUDGET_REQUEST_FAILED' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/route') {
    try {
      const result = await findRoute(await readJsonBody(request))
      return 'error' in result ? sendJson(response, result.status || 400, { error: result.error }) : sendJson(response, 200, result)
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'INVALID_ROUTE_REQUEST' })
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/optimize') {
    try {
      const result = await optimizeRoute(await readJsonBody(request, 64_000))
      return 'error' in result ? sendJson(response, result.status || 400, { error: result.error }) : sendJson(response, 200, result)
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'INVALID_OPTIMIZE_REQUEST' })
    }
  }
  if (request.method === 'GET' && await serveStatic(url, response)) return
  return sendJson(response, 404, { error: 'Not found' })
}).listen(port, () => console.log(`Where API: http://localhost:${port}`))
