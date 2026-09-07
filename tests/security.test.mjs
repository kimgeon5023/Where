import assert from 'node:assert/strict'
import test from 'node:test'
import { allowedOrigin, allowedOrigins, createRateLimiter } from '../backend/security.mjs'

test('CORS accepts configured frontend and rejects unknown origins', () => {
  const origins = allowedOrigins({ frontendUrl: 'https://where.example.com', nodeEnv: 'production' })
  assert.equal(allowedOrigin('https://where.example.com', origins), 'https://where.example.com')
  assert.equal(allowedOrigin('https://attacker.example.com', origins), null)
})

test('CORS accepts the production frontend origin', () => {
  const origins = allowedOrigins({ frontendUrl: 'https://where-silk.vercel.app', nodeEnv: 'production' })
  assert.equal(allowedOrigin('https://where-silk.vercel.app', origins), 'https://where-silk.vercel.app')
})

test('rate limiter blocks requests over its configured limit', () => {
  let time = 0; const limit = createRateLimiter({ now: () => time })
  assert.equal(limit({ key: 'login:127.0.0.1', limit: 2, windowMs: 1_000 }).allowed, true)
  assert.equal(limit({ key: 'login:127.0.0.1', limit: 2, windowMs: 1_000 }).allowed, true)
  assert.equal(limit({ key: 'login:127.0.0.1', limit: 2, windowMs: 1_000 }).allowed, false)
  time = 1_001
  assert.equal(limit({ key: 'login:127.0.0.1', limit: 2, windowMs: 1_000 }).allowed, true)
})
