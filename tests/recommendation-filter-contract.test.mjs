import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const result = await readFile(new URL('../src/pages/Result.tsx', import.meta.url), 'utf8')
const api = await readFile(new URL('../src/lib/placesApi.ts', import.meta.url), 'utf8')
const server = await readFile(new URL('../backend/server.mjs', import.meta.url), 'utf8')
const scoring = await readFile(new URL('../src/lib/scoring.ts', import.meta.url), 'utf8')

test('recommendation filters apply tags and valid numeric inputs without a page reload', () => {
  assert.match(result, /const \[draftTags, setDraftTags\]/)
  assert.match(result, /const \[appliedTags, setAppliedTags\]/)
  assert.match(result, /setAppliedTags\(draftTags\)/)
  assert.match(result, /setBudgetFilter\(nextBudget\)/)
  assert.match(result, /result-filter-apply/)
  assert.match(result, /\[budgetInput, setBudgetInput\] = useState\(''\)/)
  assert.match(result, /setAppliedTags\(draftTags\)/)
  assert.match(result, /window\.setTimeout\(\(\) =>/)
})

test('headcount is validated, persisted in the result request, and sent with place searches', () => {
  assert.match(result, /headcountInput, setHeadcountInput/)
  assert.match(result, /headcount: req\.headcount/)
  assert.match(result, /여행 인원수 필터/)
  assert.match(result, /request\.companion === 'alone' \? request\.headcount === 1/)
  assert.match(api, /headcount\?: number/)
})

test('applied budget reaches the place API and filters priced Kakao results server-side', () => {
  assert.match(api, /maxPrice\?: number/)
  assert.match(result, /maxPrice: maxPlacePrice/)
  assert.match(server, /const maxPriceParameter = url\.searchParams\.get\('maxPrice'\)/)
  assert.match(server, /place\.price <= maxPrice/)
  assert.match(server, /includeLodging, maxPrice, limit/)
})

test('automatic courses reserve daily transport and never add a place over a set budget', () => {
  assert.match(scoring, /let spent = transportCost \* days/)
  assert.match(scoring, /spent \+ visitCost\(item\.place, req\) <= req\.budgetPerPerson/)
  assert.match(scoring, /\(req\.transport === 'car' \? 30000 : 6000\) \* tripDays\(req\)/)
})

test('recommendation score includes a group-size signal', () => {
  assert.match(scoring, /function groupSizeFit/)
  assert.match(scoring, /인원 적합/)
})
