import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const card = await readFile(new URL('../src/components/PlaceCard.tsx', import.meta.url), 'utf8')

test('reviews accept a photo without text', () => {
  assert.match(card, /!reviewText\.trim\(\) && !imageUrl/)
})

test('review image payloads stay below the upload budget', () => {
  assert.match(card, /dataUrl\.length <= 360_000/)
})
