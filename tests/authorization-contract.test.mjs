import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const server = await readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8')
const database = await readFile(new URL('../backend/database.mjs', import.meta.url), 'utf8')

test('private favorites and trips are JWT protected', () => {
  assert.match(server, /url\.pathname === '\/api\/favorites'[\s\S]{0,180}authenticatedUserId/)
  assert.match(server, /url\.pathname === '\/api\/trips'[\s\S]{0,180}authenticatedUserId/)
})

test('ownership, administrator overrides, and cascade contracts remain in SQL', () => {
  assert.match(database, /DELETE FROM favorites WHERE user_id = \$1 AND place_id = \$2/)
  assert.match(database, /DELETE FROM trips WHERE id = \$1 AND \(user_id = \$2 OR \$3\)/)
  assert.match(database, /role = 'admin'/)
  assert.match(server, /\/api\/admin\/users/)
  assert.match(database, /trip_id UUID NOT NULL REFERENCES trips\(id\) ON DELETE CASCADE/)
  assert.match(database, /share_token = \$1 AND is_public = TRUE/)
})
