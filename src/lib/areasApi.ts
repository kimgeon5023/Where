import { apiUrl } from './api'
import { isSeoulDistrict } from './seoulDistricts'

export type SeoulArea = { id: number; name: string }

export async function searchSeoulAreas(query: string, signal?: AbortSignal): Promise<SeoulArea[]> {
  const q = query.trim()
  if (!q) return []
  const params = new URLSearchParams({ q, limit: '8' })
  const response = await fetch(apiUrl(`/api/areas?${params}`), { signal })
  if (!response.ok) throw new Error('지역 검색을 불러오지 못했습니다.')
  const body = await response.json() as { data?: SeoulArea[] }
  return Array.isArray(body.data) ? body.data.filter((area): area is SeoulArea => isSeoulDistrict(area.name)) : []
}
