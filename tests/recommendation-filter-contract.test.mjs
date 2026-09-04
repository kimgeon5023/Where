import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const result = await readFile(new URL('../src/pages/Result.tsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/lib/placesApi.ts', import.meta.url), 'utf8')
const server = await readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8')
const scoring = await readFile(new URL('../src/lib/scoring.ts', import.meta.url), 'utf8')

test('recommendation filters stage category choices until the user applies them', () => {
  assert.match(result, /const \[draftTags, setDraftTags\]/)
  assert.match(result, /const \[appliedTags, setAppliedTags\]/)
  assert.match(result, /setAppliedTags\(draftTags\)/)
  assert.match(result, /setAppliedTags\(draftTags\)/)
  assert.match(result, /result-filter-apply/)
  assert.doesNotMatch(result, /maxPrice:/)
})

test('place search has no price or lodging search controls and travel plan is available', () => {
  assert.doesNotMatch(api, /maxPrice\?: number/)
  assert.doesNotMatch(api, /includeLodging\?: boolean/)
  assert.doesNotMatch(server, /maxPriceParameter/)
  assert.doesNotMatch(server, /includeLodging/)
  assert.match(server, /url\.pathname === '\/api\/travel-plan'/)
})

test('budget excludes accommodation and has four expected estimate categories', () => {
  assert.doesNotMatch(scoring, /lodging/)
  assert.match(scoring, /관광\/액티비티 비용/)
  assert.match(scoring, /기타 비용/)
})
