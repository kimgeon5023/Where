import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eunpyeongPlaces } from './eunpyeongPlaces.mjs'
import { createPasswordUser, initializeDatabase, listUsers, siteId, upsertGoogleUser } from './database.mjs'
import { createGoogleAuthorizationUrl, fetchGoogleProfile } from './oauth.mjs'

const existingPlaces = JSON.parse(await readFile(new URL('../src/data/places.json', import.meta.url), 'utf8'))
const places = [...eunpyeongPlaces, ...existingPlaces]
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
const searchableCategories = new Set(['food', 'cafe', 'tour', 'lodging', 'activity'])
const configuredPort = Number(process.env.PORT || 3001)
const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3001
const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:5173').replace(/\/$/, '')
const kakaoRestApiKey = process.env.KAKAO_REST_API_KEY?.trim() || ''
const kakaoCategoryCodes = { food: 'FD6', cafe: 'CE7', tour: 'AT4', photo: 'AT4', activity: 'CT1', lodging: 'AD5' }
const seoulDistrictCenters = {
  강남구: [37.5172, 127.0473], 강동구: [37.5301, 127.1238], 강북구: [37.6396, 127.0257], 강서구: [37.5509, 126.8495], 관악구: [37.4784, 126.9516], 광진구: [37.5385, 127.0823], 구로구: [37.4954, 126.8874], 금천구: [37.4569, 126.8955], 노원구: [37.6542, 127.0568], 도봉구: [37.6688, 127.0471], 동대문구: [37.5744, 127.0396], 동작구: [37.5124, 126.9393], 마포구: [37.5663, 126.9019], 서대문구: [37.5791, 126.9368], 서초구: [37.4837, 127.0324], 성동구: [37.5633, 127.0371], 성북구: [37.5894, 127.0167], 송파구: [37.5145, 127.1059], 양천구: [37.5170, 126.8664], 영등포구: [37.5264, 126.8962], 용산구: [37.5326, 126.9906], 은평구: [37.6027, 126.9291], 종로구: [37.5735, 126.9788], 중구: [37.5641, 126.9979], 중랑구: [37.6063, 127.0927],
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  response.end(JSON.stringify(body))
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

function frontendOAuthRedirect(response, { user, error }, cookies = []) {
  const fragment = user
    ? `oauth_user=${Buffer.from(JSON.stringify(user)).toString('base64url')}`
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
    frontendOAuthRedirect(response, { user }, [clearedCookie])
  } catch (error) {
    console.error('Google OAuth callback failed:', error instanceof Error ? error.message : 'UNKNOWN_ERROR')
    const message = error instanceof Error && error.message === 'OAUTH_ACCESS_DENIED'
      ? '로그인 동의가 취소됐습니다.'
      : '소셜 로그인을 완료하지 못했습니다.'
    frontendOAuthRedirect(response, { error: message }, [clearedCookie])
  }
}

function matchesArea(place, area) {
  if (!area || ['서울', '서울시', '서울특별시', 'seoul'].includes(area.toLowerCase())) return true
  const query = area.toLowerCase()
  return [place.name, place.area, place.district].filter(Boolean).some((value) => value.toLowerCase().includes(query))
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const radians = (value) => value * Math.PI / 180
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function kakaoPlaceToPlace(item, category, origin) {
  const lat = Number(item.y); const lng = Number(item.x)
  const distanceKm = Number(haversineKm(origin.lat, origin.lng, lat, lng).toFixed(2))
  return { id: `kakao-${item.id}`, name: item.place_name, area: item.road_address_name || item.address_name || '서울', category: category || 'tour', lat, lng, tags: [], groupFit: ['friends', 'couple', 'family', 'alone'], indoor: category !== 'tour' && category !== 'photo', price: 0, durationMin: category === 'food' ? 70 : 60, rating: 0, description: item.category_name || item.place_name, image: '', accent: '#1d9b77', distanceKm, phone: item.phone || '', placeUrl: item.place_url || '' }
}

async function searchKakaoPlaces(url, category, keyword, area, limit, origin) {
  if (!kakaoRestApiKey) return null
  const selectedDistrict = /구$/.test(area)
  const searchKeyword = keyword
  const districtCenter = selectedDistrict ? seoulDistrictCenters[area] : null
  const searchCenter = districtCenter ? { lat: districtCenter[0], lng: districtCenter[1] } : origin
  const endpoint = searchKeyword ? 'https://dapi.kakao.com/v2/local/search/keyword.json' : 'https://dapi.kakao.com/v2/local/search/category.json'
  const params = new URLSearchParams({ size: String(Math.min(limit, 15)), page: '1', x: String(searchCenter.lng), y: String(searchCenter.lat), radius: String(Math.min(Number(url.searchParams.get('radius') || 8000), 20000)), ...(searchKeyword ? { query: searchKeyword } : { category_group_code: kakaoCategoryCodes[category || 'activity'] }) })
  const response = await fetch(`${endpoint}?${params}`, { headers: { Authorization: `KakaoAK ${kakaoRestApiKey}` } })
  if (!response.ok) throw new Error(`KAKAO_PLACES_${response.status}`)
  const payload = await response.json()
  const documents = selectedDistrict
    ? (payload.documents || []).filter((item) => `${item.address_name || ''} ${item.road_address_name || ''}`.includes(area))
    : (payload.documents || [])
  const data = documents.map((item) => kakaoPlaceToPlace(item, category || 'activity', origin)).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, limit)
  return { data, meta: { total: data.length, area: area || '서울', category: category || 'all', source: 'kakao' } }
}

async function findPlaces(url) {
  const area = url.searchParams.get('area')?.trim() ?? ''
  const category = url.searchParams.get('category')?.trim() ?? ''
  const keyword = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const requestedLimit = Number(url.searchParams.get('limit') ?? 60)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 60

  if (category && !searchableCategories.has(category)) {
    return { error: 'category must be food, cafe, tour, lodging, or activity' }
  }

  const origin = { lat: Number(url.searchParams.get('lat')) || 37.5668, lng: Number(url.searchParams.get('lng')) || 126.978 }
  if (kakaoRestApiKey && (category || keyword || /구$/.test(area))) {
    try {
      const live = await searchKakaoPlaces(url, category, keyword, area, limit, origin)
      if (live) return live
    } catch (error) { console.error('Kakao place search failed:', error instanceof Error ? error.message : 'UNKNOWN_ERROR') }
  }

  const data = places.filter((place) => {
    const text = [place.name, place.area, place.district, place.category].filter(Boolean).join(' ').toLowerCase()
    return matchesArea(place, area) && (!category || place.category === category) && (!keyword || text.includes(keyword))
  }).slice(0, limit)

  return { data: data.map((place) => ({ ...place, distanceKm: Number(haversineKm(origin.lat, origin.lng, place.lat, place.lng).toFixed(2)) })).sort((a, b) => a.distanceKm - b.distanceKm), meta: { total: data.length, area: area || '서울', category: category || 'all', source: 'catalog' } }
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 16_384) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('INVALID_JSON')
  }
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

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost:3001')
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})
  if (request.method === 'GET' && url.pathname === '/api/health') return sendJson(response, 200, { ok: true, database: 'postgresql', siteId })
  if (request.method === 'GET' && url.pathname === '/api/auth/oauth/google') return startGoogleOAuth(request, response)
  if (request.method === 'GET' && url.pathname === '/api/auth/oauth/google/callback') return completeGoogleOAuth(request, response, url)
  if (request.method === 'GET' && url.pathname === '/api/auth/users') return sendJson(response, 200, { data: await listUsers() })
  if (request.method === 'POST' && url.pathname === '/api/auth/signup') {
    try {
      const validation = validateSignup(await readJsonBody(request))
      if ('error' in validation) return sendJson(response, 400, validation)
      return sendJson(response, 201, { user: await createPasswordUser(validation.value) })
    } catch (error) {
      if (error instanceof Error && error.code === 'USERNAME_ALREADY_EXISTS') return sendJson(response, 409, { error: '이미 사용 중인 아이디입니다.' })
      if (error instanceof Error && error.message === 'INVALID_JSON') return sendJson(response, 400, { error: '요청 형식이 올바르지 않습니다.' })
      if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') return sendJson(response, 413, { error: '요청이 너무 큽니다.' })
      return sendJson(response, 500, { error: '회원가입을 처리하지 못했습니다.' })
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/places') {
    const result = await findPlaces(url)
    return 'error' in result ? sendJson(response, 400, result) : sendJson(response, 200, result)
  }
  if (request.method === 'GET' && await serveStatic(url, response)) return
  return sendJson(response, 404, { error: 'Not found' })
}).listen(port, () => console.log(`Where API: http://localhost:${port}`))
