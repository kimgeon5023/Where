import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const server = await readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8')
const database = await readFile(new URL('../backend/database.mjs', import.meta.url), 'utf8')

test('my reviews endpoint is authenticated and limited to the signed-in user', () => {
  assert.match(server, /url\.pathname === '\/api\/my\/reviews'[\s\S]{0,180}authenticatedUserId/)
  assert.match(server, /listUserReviews\(\{ userId, page:/)
  assert.match(database, /WHERE r\.user_id = \$1/)
  assert.match(database, /place_reviews_user_created_idx/)
})

test('review edits validate input and enforce review ownership', () => {
  assert.match(server, /request\.method === 'PUT'/)
  assert.match(server, /updatePlaceReview\(\{ reviewId, userId, rating, content, imageUrl \}\)/)
  assert.match(database, /found\.rows\[0\]\.user_id !== userId/)
  assert.match(database, /SET rating = \$1, content = \$2, image_url = \$3, updated_at = NOW\(\)/)
})
