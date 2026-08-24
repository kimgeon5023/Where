import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eunpyeongPlaces } from './eunpyeongPlaces.mjs'
import { createPasswordUser, initializeDatabase, listUsers, siteId } from './database.mjs'

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

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  response.end(JSON.stringify(body))
}

function matchesArea(place, area) {
  if (!area || ['서울', '서울시', '서울특별시', 'seoul'].includes(area.toLowerCase())) return true
  const query = area.toLowerCase()
  return [place.name, place.area, place.district].filter(Boolean).some((value) => value.toLowerCase().includes(query))
}

function findPlaces(url) {
  const area = url.searchParams.get('area')?.trim() ?? ''
  const category = url.searchParams.get('category')?.trim() ?? ''
  const keyword = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const requestedLimit = Number(url.searchParams.get('limit') ?? 60)
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 60

  if (category && !searchableCategories.has(category)) {
    return { error: 'category must be food, cafe, tour, lodging, or activity' }
  }

  const data = places.filter((place) => {
    const text = [place.name, place.area, place.district, place.category].filter(Boolean).join(' ').toLowerCase()
    return matchesArea(place, area) && (!category || place.category === category) && (!keyword || text.includes(keyword))
  }).slice(0, limit)

  return { data, meta: { total: data.length, area: area || '서울', category: category || 'all' } }
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
    const result = findPlaces(url)
    return 'error' in result ? sendJson(response, 400, result) : sendJson(response, 200, result)
  }
  if (request.method === 'GET' && await serveStatic(url, response)) return
  return sendJson(response, 404, { error: 'Not found' })
}).listen(port, () => console.log(`Where API: http://localhost:${port}`))
