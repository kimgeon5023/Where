import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const context = await readFile(new URL('../src/favorites/FavoritesContext.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/legacyFavorites.ts', import.meta.url), 'utf8')
const savedPage = await readFile(new URL('../src/pages/Saved.tsx', import.meta.url), 'utf8')
const placeCard = await readFile(new URL('../src/components/PlaceCard.tsx', import.meta.url), 'utf8')

test('favorites stay available on this device after sign-out and are scoped by account', () => {
  assert.match(context, /setFavorites\(getLastFavoriteSnapshot\(\)\)/)
  assert.match(context, /getFavoriteSnapshot\(user\.id\)/)
  assert.match(context, /saveFavoriteSnapshot\(user\.id, places\)/)
  assert.match(cache, /where-account-favorites:\$\{userId\}/)
})

test('saved place cards expose an explicit favorite removal action', () => {
  assert.match(savedPage, /isSaved showUnsaveAction onToggleSaved/)
  assert.match(placeCard, /찜 해제/)
  assert.match(placeCard, /onClick=\{toggleSaved\}/)
})
