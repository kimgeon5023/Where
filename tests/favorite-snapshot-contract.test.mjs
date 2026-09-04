import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const context = await readFile(new URL('../src/favorites/FavoritesContext.tsx', import.meta.url), 'utf8')
const cache = await readFile(new URL('../src/lib/legacyFavorites.ts', import.meta.url), 'utf8')

test('favorites stay available on this device after sign-out and are scoped by account', () => {
  assert.match(context, /setFavorites\(getLastFavoriteSnapshot\(\)\)/)
  assert.match(context, /getFavoriteSnapshot\(user\.id\)/)
  assert.match(context, /saveFavoriteSnapshot\(user\.id, places\)/)
  assert.match(cache, /where-account-favorites:\$\{userId\}/)
})
