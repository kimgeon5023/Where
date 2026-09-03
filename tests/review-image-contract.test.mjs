import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const server = await readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8')
const card = await readFile(new URL('../src/components/PlaceCard.tsx', import.meta.url), 'utf8')

test('reviews accept a photo without text and persist its data URL', () => {
  assert.match(card, /!reviewText\.trim\(\) && !imageUrl/)
  assert.match(server, /if \(!content && !imageUrl\)/)
  assert.match(server, /createPlaceReview\(\{ userId, placeId, rating, content, imageUrl \}\)/)
})

test('review image payloads have matching client and API limits', () => {
  assert.match(card, /dataUrl\.length <= 520_000/)
  assert.match(server, /maxReviewImageDataUrlLength = 520_000/)
  assert.match(server, /readJsonBody\(request, maxReviewRequestBytes\)/)
  assert.match(server, /REQUEST_TOO_LARGE' \? 413/)
})
