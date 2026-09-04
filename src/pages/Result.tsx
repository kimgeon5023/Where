import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { searchPlaces, searchRoute, type RouteResponse } from '../lib/placesApi'
import { buildItineraries, estimateBudget, recommend, type ScoredPlace, type ItineraryStop } from '../lib/scoring'
import { useFavorites } from '../favorites/FavoritesContext'
import type { Companion, Place, Tag, TripRequest } from '../types'
import Icon, { type IconName } from '../components/Icon'
import MapView from '../components/MapView'
import PlaceCard from '../components/PlaceCard'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../auth/AuthContext'
import { createTrip, toTripInput, updateTrip, type Trip } from '../lib/tripsApi'
import { useTrips } from '../trips/TripsContext'
import { isSeoulDistrict } from '../lib/seoulDistricts'

const RESULT_REQUEST_STORAGE_KEY = 'where-result-request'

function isTripRequest(value: unknown): value is TripRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<TripRequest>
  return isSeoulDistrict(request.start ?? '')
    && typeof request.dateStart === 'string' && Boolean(request.dateStart)
    && typeof request.dateEnd === 'string' && Boolean(request.dateEnd)
    && ['friends', 'couple', 'family', 'alone'].includes(request.companion ?? '')
    && typeof request.headcount === 'number'
    && typeof request.budgetPerPerson === 'number'
    && ['public', 'car'].includes(request.transport ?? '')
    && Array.isArray(request.likes) && Array.isArray(request.dislikes)
    && ['sunny', 'cloudy', 'rain'].includes(request.weather ?? '')
}

function readStoredTripRequest(): TripRequest | null {
  try {
    const stored = sessionStorage.getItem(RESULT_REQUEST_STORAGE_KEY)
    const parsed: unknown = stored ? JSON.parse(stored) : null
    return isTripRequest(parsed) ? parsed : null
  } catch {
    return null
  }
}

const companionLabels = { friends: '친구', couple: '연인', family: '가족', alone: '혼자' }
const weatherLabels: Record<TripRequest['weather'], { icon: IconName; label: string; temp: string; rain: string }> = { sunny: { icon: 'sun', label: '맑음', temp: '27°', rain: '강수확률 10%' }, cloudy: { icon: 'cloud', label: '구름 조금', temp: '25°', rain: '강수확률 20%' }, rain: { icon: 'rain', label: '비', temp: '22°', rain: '강수확률 70%' } }
const categoryIcons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }
const searchCategories: { value: Tag; label: string }[] = [
  { value: 'cafe', label: '카페' }, { value: 'foodie', label: '맛집' }, { value: 'nature', label: '자연' },
  { value: 'activity', label: '액티비티' }, { value: 'shopping', label: '쇼핑' }, { value: 'rest', label: '휴식' },
]
const tasteOptions: { value: Tag; label: string }[] = [
  { value: 'foodie', label: '맛집' }, { value: 'cafe', label: '카페' }, { value: 'nature', label: '자연' },
  { value: 'activity', label: '액티비티' }, { value: 'shopping', label: '쇼핑' }, { value: 'rest', label: '휴식' },
]
const companions: { value: Companion; label: string; icon: IconName; caption: string }[] = [
  { value: 'friends', label: '친구와', icon: 'friends', caption: '함께 만드는 하루' },
  { value: 'couple', label: '연인과', icon: 'heart', caption: '설레는 데이트' },
  { value: 'family', label: '가족과', icon: 'family', caption: '편안한 나들이' },
  { value: 'alone', label: '혼자', icon: 'person', caption: '나만의 시간' },
]
type SortKey = 'score' | 'rating' | 'reviews' | 'distance'
const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'score', label: '추천순' }, { value: 'rating', label: '별점 높은순' },
  { value: 'reviews', label: '후기 많은순' }, { value: 'distance', label: '거리순' },
]

function dateLabel(date: string) {
  if (!date) return ''
  const value = new Date(date + 'T00:00:00')
  return value.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })
}

type LiveLocation = { lat: number; lng: number; accuracy: number; updatedAt: number }
type RoadRouteMetric = { distanceMeters: number; durationSeconds: number }

function formatGpsDistance(meters: number) {
  return meters < 1_000 ? `${Math.round(meters)}m` : `${(meters / 1_000).toFixed(2)}km`
}

function daysBetween(start: string, end: string) {
  const diff = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1
  return Math.max(1, Math.min(3, diff || 1))
}

function sortScored(items: ScoredPlace[], sort: SortKey): ScoredPlace[] {
  const sorted = [...items]
  switch (sort) {
    case 'rating': return sorted.sort((a, b) => b.place.rating - a.place.rating)
    case 'distance': return sorted.sort((a, b) => (a.place.distanceKm ?? Infinity) - (b.place.distanceKm ?? Infinity))
    // The Kakao search response currently has no review count. Keep this option
    // stable until the review summary API enriches each place.
    case 'reviews': return sorted.sort((a, b) => b.score - a.score)
    default: return sorted.sort((a, b) => (b.fitScore + b.score) - (a.fitScore + a.score))
  }
}

function SkeletonCard() {
  return (
    <div className="place-card" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="place-image" style={{ background: '#e8ece7' }} />
      <div className="place-body">
        <div className="place-title-row"><div style={{ flex: 1 }}><div style={{ width: 60, height: 10, borderRadius: 4, background: '#e8ece7', marginBottom: 8 }} /><div style={{ width: 140, height: 18, borderRadius: 6, background: '#e8ece7' }} /></div></div>
        <div style={{ marginTop: 12, width: '100%', height: 12, borderRadius: 4, background: '#e8ece7' }} />
        <div style={{ marginTop: 8, width: '70%', height: 12, borderRadius: 4, background: '#e8ece7' }} />
      </div>
    </div>
  )
}

function shareCourse(req: TripRequest, places: Place[]) {
  const params = new URLSearchParams({
    s: req.start, d: req.dateStart, e: req.dateEnd,
    c: req.companion, n: String(req.headcount),
    b: String(req.budgetPerPerson), t: req.transport, w: req.weather,
    l: req.likes.join(','), dl: req.dislikes.join(','),
    p: places.slice(0, 5).map((p) => p.id).join(','),
  })
  const url = `${window.location.origin}/result?${params.toString()}`
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => alert('코스 링크가 복사되었어요!'))
  } else {
    prompt('아래 링크를 복사해서 공유하세요:', url)
  }
}

export default function Result() {
  const location = useLocation()
  // Keep the restored request in React state. Parsing sessionStorage during every
  // render creates a new object and makes the place-search effect run repeatedly.
  const [req, setReq] = useState<TripRequest | null>(() => {
    return isTripRequest(location.state) ? location.state : readStoredTripRequest()
  })
  const [excluded, setExcluded] = useState<string[]>([])
  const [day, setDay] = useState(0)
  const [draftTags, setDraftTags] = useState<Tag[]>([])
  const [appliedTags, setAppliedTags] = useState<Tag[]>([])
  const [budgetFilter, setBudgetFilter] = useState(0)
  const [budgetInput, setBudgetInput] = useState('')
  const [filterError, setFilterError] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [apiPlaces, setApiPlaces] = useState<Place[]>([])
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null)
  const [roadLocation, setRoadLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchRevision, setSearchRevision] = useState(0)
  const [recommendationSeed] = useState(() => Math.random())
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>()
  const [route, setRoute] = useState<RouteResponse['data'] | null>(null)
  const [routeStatus, setRouteStatus] = useState('')
  const [routeRevision, setRouteRevision] = useState(0)
  const [roadRoutes, setRoadRoutes] = useState<Map<string, RoadRouteMetric>>(new Map())
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const { user } = useAuth()
  const { trips, refreshTrips } = useTrips()
  const [tripActionBusy, setTripActionBusy] = useState(false)
  const [savedTrip, setSavedTrip] = useState<Trip | null>(null)
  const [tripNotice, setTripNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [editedDays, setEditedDays] = useState<Record<number, ItineraryStop[]>>({})
  const [manualCourseDays, setManualCourseDays] = useState<Record<number, ItineraryStop[]>>({})
  const [isManualCourseEditing, setIsManualCourseEditing] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dayCount = req ? daysBetween(req.dateStart, req.dateEnd) : 1
  const transportBudget = req ? (req.transport === 'car' ? 30_000 : 6_000) * dayCount : 0
  const maxPlacePrice = budgetFilter > 0 ? Math.max(0, budgetFilter - transportBudget) : undefined

  const applyFilters = () => {
    const nextBudget = budgetInput ? Number(budgetInput) : 0
    if (!Number.isInteger(nextBudget) || (budgetInput !== '' && nextBudget < 1) || nextBudget > 10_000_000) {
      setFilterError('예산은 1원부터 1,000만 원까지 입력해 주세요.')
      return
    }
    setFilterError('')
    setAppliedTags(draftTags)
    setBudgetFilter(nextBudget)
    setApiPlaces([])
    setHasMore(false)
    setSearchPage(1)
    setDay(0)
  }
  const updateReq = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => {
    setReq((current) => {
      if (!current) return current
      const next = { ...current, [key]: value }
      try { sessionStorage.setItem(RESULT_REQUEST_STORAGE_KEY, JSON.stringify(next)) } catch { /* storage is optional */ }
      return next
    })
  }

  useEffect(() => {
    if (!isTripRequest(location.state)) return
    try { sessionStorage.setItem(RESULT_REQUEST_STORAGE_KEY, JSON.stringify(location.state)) } catch { /* storage is optional */ }
    setReq(location.state)
  }, [location.state])

  useEffect(() => { if (!tripNotice) return; const timer = window.setTimeout(() => setTripNotice(null), 3500); return () => window.clearTimeout(timer) }, [tripNotice])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition((position) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude }
      // Keep every GPS update for the distance shown to the user. The separate
      // userLocation state below remains deliberately less chatty for API search.
      setLiveLocation({ ...next, accuracy: Math.round(position.coords.accuracy), updatedAt: Date.now() })
      // Recalculate road routes after meaningful movement without sending a
      // directions request for small GPS jitter.
      setRoadLocation((current) => current && Math.abs(current.lat - next.lat) < 0.00025 && Math.abs(current.lng - next.lng) < 0.00025 ? current : next)
      // GPS watch callbacks can arrive repeatedly with small accuracy jitter.
      // Do not abort and restart the place request unless the user has moved
      // roughly 200m, otherwise a result page can stay in a retry loop.
      setUserLocation((current) => current && Math.abs(current.lat - next.lat) < 0.002 && Math.abs(current.lng - next.lng) < 0.002 ? current : next)
    }, () => { setLiveLocation(null); setRoadLocation(null) }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    // Do not call Kakao until a complete, validated request has been restored.
    if (!req) return
    const controller = new AbortController()
    let retryTimer: number | undefined
    let attempts = 0
    const loadPlaces = () => {
      retryTimer = undefined
      setApiError('')
      setLoading(true)
      const origin = userLocation ?? { lat: 37.5668, lng: 126.978 }
      searchPlaces({ area: req.start, companion: req.companion, q: keyword.trim(), tags: appliedTags, includeLodging: false, maxPrice: maxPlacePrice, page: searchPage, limit: 20, lat: origin.lat, lng: origin.lng, radius: 6_000 }, controller.signal)
      .then(({ data, meta }) => {
        setApiPlaces((current) => searchPage === 1 ? data : [...current, ...data.filter((place) => !current.some((existing) => existing.id === place.id))])
        setHasMore(Boolean(meta.hasMore) && data.length > 0)
        if (data.length === 0) setApiError('이 조건과 지도 영역에서 찾은 장소가 없어요. 검색어 또는 지도를 바꿔보세요.')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // Render can briefly be unavailable while waking or redeploying. Keep
        // the last successful list on screen instead of making every card vanish.
        // A sleeping Render instance can take close to a minute to wake up.
        // Keep retrying in this open screen so the user never needs to refresh.
        if (attempts < 6 && !controller.signal.aborted) {
          attempts += 1
          retryTimer = window.setTimeout(loadPlaces, Math.min(15_000, attempts * 3_000))
          setApiError('추천 장소 서버와 다시 연결 중이에요. 새로고침하지 않아도 이 화면에서 자동으로 표시됩니다.')
          return
        }
        setApiError('추천 장소 서버 연결이 오래 지연되고 있어요. 현재 목록은 유지했으며, 아래 버튼으로 다시 연결할 수 있습니다.')
      })
      .finally(() => {
        if (retryTimer === undefined) setLoading(false)
      })
    }
    const timer = window.setTimeout(loadPlaces, 300)
    return () => { window.clearTimeout(timer); if (retryTimer !== undefined) window.clearTimeout(retryTimer); controller.abort() }
  }, [req, appliedTags, maxPlacePrice, userLocation, keyword, searchRevision, searchPage])

  const filterRequest = useMemo(() => req ? { ...req, likes: appliedTags, budgetPerPerson: budgetFilter } : null, [req, appliedTags, budgetFilter])
  const scored = useMemo(() => filterRequest ? recommend(apiPlaces, filterRequest, excluded, recommendationSeed) : [], [filterRequest, apiPlaces, excluded, recommendationSeed])
  const sortedScored = useMemo(() => sortScored(scored, sort), [scored, sort])
  const itineraries = useMemo(() => filterRequest ? buildItineraries(scored, filterRequest, dayCount, recommendationSeed) : [], [scored, filterRequest, dayCount, recommendationSeed])
  const rawCurrentCourse = itineraries[day] ?? []
  const automaticCurrentCourse = editedDays[day] ?? rawCurrentCourse
  const currentCourse = isManualCourseEditing ? manualCourseDays[day] ?? [] : automaticCurrentCourse
  const persistedCourseDays = useMemo(() => isManualCourseEditing
    ? Array.from({ length: dayCount }, (_, index) => (manualCourseDays[index] ?? []).map((stop) => stop.place))
    : itineraries.map((itinerary, index) => (editedDays[index] ?? itinerary).map((stop) => stop.place)), [isManualCourseEditing, manualCourseDays, dayCount, itineraries, editedDays])

  const handleDragStart = useCallback((index: number) => { setDragIndex(index) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index) }, [])
  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return }
    const updated = [...currentCourse]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    if (isManualCourseEditing) setManualCourseDays((current) => ({ ...current, [day]: updated }))
    else setEditedDays((current) => ({ ...current, [day]: updated }))
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, currentCourse, day, isManualCourseEditing])
  const allCourse = useMemo(() => {
    const seen = new Set<string>()
    return persistedCourseDays.flat().filter((place) => {
      if (seen.has(place.id)) return false
      seen.add(place.id)
      return true
    }).map((place) => scored.find((item) => item.place.id === place.id)).filter(Boolean) as typeof scored
  }, [persistedCourseDays, scored])
  const budget = useMemo(() => filterRequest ? estimateBudget(filterRequest, allCourse) : { items: [], total: 0, perPerson: 0 }, [filterRequest, allCourse])
  const coursePlaces = useMemo(() => currentCourse.map((stop) => stop.place), [currentCourse])
  const saveCourse = useCallback(async (isPublic: boolean) => {
    if (!filterRequest || !user?.token) { setTripNotice({ kind: 'error', text: '코스 저장은 로그인 후 이용할 수 있습니다.' }); return }
    if (!persistedCourseDays.flat().length) { setTripNotice({ kind: 'error', text: '저장할 장소가 없습니다.' }); return }
    const title = savedTrip?.title || window.prompt('코스 이름을 입력해주세요.', `${filterRequest.start} 여행 코스`)
    if (!title?.trim()) return
    setTripActionBusy(true)
    try {
      const input = toTripInput(filterRequest, persistedCourseDays, title.trim(), isPublic)
      const trip = savedTrip ? await updateTrip(savedTrip.id, input, user.token) : await createTrip(input, user.token)
      setSavedTrip(trip)
      await refreshTrips()
      if (isPublic && trip.shareToken) {
        const shareUrl = `${window.location.origin}/share/trips/${trip.shareToken}`
        if (navigator.clipboard) await navigator.clipboard.writeText(shareUrl)
        else { shareCourse(filterRequest, persistedCourseDays.flat()); window.prompt('공유 링크를 복사해주세요.', shareUrl) }
        setTripNotice({ kind: 'success', text: '공개 코스를 저장하고 공유 링크를 복사했습니다.' })
      } else setTripNotice({ kind: 'success', text: '내 코스에 저장했습니다.' })
    } catch (error) { setTripNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 저장하지 못했습니다.' }) } finally { setTripActionBusy(false) }
  }, [filterRequest, user, persistedCourseDays, savedTrip, refreshTrips])
  const startManualCourse = () => {
    setManualCourseDays({})
    setIsManualCourseEditing(true)
    setDay(0)
    setTripNotice({ kind: 'success', text: '직접 코스 만들기를 시작했어요. 추천 장소에서 원하는 곳을 추가하세요.' })
  }
  const cancelManualCourse = () => {
    setManualCourseDays({})
    setIsManualCourseEditing(false)
    setTripNotice({ kind: 'success', text: '직접 코스 초안을 취소했어요.' })
  }
  const isInManualCourse = (placeId: string) => Object.values(manualCourseDays).some((stops) => stops.some((stop) => stop.place.id === placeId))
  const toggleManualPlace = (place: Place) => {
    if (isInManualCourse(place.id)) {
      setManualCourseDays((current) => Object.fromEntries(Object.entries(current).map(([key, stops]) => [key, stops.filter((stop) => stop.place.id !== place.id)])))
      return
    }
    setManualCourseDays((current) => {
      const stops = current[day] ?? []
      const hour = Math.min(21, 10 + stops.length * 2)
      return { ...current, [day]: [...stops, { time: `${String(hour).padStart(2, '0')}:00`, emoji: '', place }] }
    })
  }
  const completeManualCourse = async () => {
    if (!filterRequest || !user?.token) { setTripNotice({ kind: 'error', text: '코스 저장은 로그인 후 이용할 수 있습니다.' }); return }
    if (!persistedCourseDays.flat().length) { setTripNotice({ kind: 'error', text: '저장할 장소를 한 곳 이상 추가해 주세요.' }); return }
    const title = window.prompt('코스 이름을 입력해 주세요.', `${filterRequest.start} 여행 코스`)
    if (!title?.trim()) return
    setTripActionBusy(true)
    try {
      await createTrip(toTripInput(filterRequest, persistedCourseDays, title.trim(), false), user.token)
      await refreshTrips()
      setManualCourseDays({})
      setIsManualCourseEditing(false)
      setTripNotice({ kind: 'success', text: '직접 만든 코스를 내 코스에 저장했어요.' })
    } catch (error) { setTripNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 저장하지 못했습니다.' }) }
    finally { setTripActionBusy(false) }
  }
  // Explore results are not capped at eight. Additional API pages are appended
  // through the “더보기” button below; every request remains limited to 20.
  const recommended = sortedScored
  const recommendedPlaces = recommended.map((item) => item.place)
  const mapPlaces = (isManualCourseEditing ? coursePlaces : (recommendedPlaces.length > 0 ? recommendedPlaces : coursePlaces)).filter((place) => place.category !== 'lodging').slice(0, 40)
  const center: [number, number] = mapPlaces[0] ? [mapPlaces[0].lat, mapPlaces[0].lng] : [37.5668, 126.978]
  const weather = req ? weatherLabels[req.weather] : weatherLabels.sunny

  useEffect(() => {
    if (!req || coursePlaces.length === 0) { setRoute(null); return }
    if (req.transport !== 'car') {
      setRoute(null)
      setRouteStatus('대중교통 실시간 경로는 장소 카드에서 카카오맵 길찾기를 이용해주세요.')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRouteStatus('실시간 차량 경로를 계산하는 중이에요.')
      const origin = userLocation ?? { lat: coursePlaces[0].lat, lng: coursePlaces[0].lng }
      searchRoute({ origin, stops: coursePlaces.slice(0, 5).map(({ lat, lng }) => ({ lat, lng })), transport: 'car' }, controller.signal)
        .then(({ data }) => { setRoute(data); setRouteStatus('') })
        .catch(() => { setRoute(null); setRouteStatus('실시간 차량 경로를 불러오지 못했어요.') })
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [req, coursePlaces, userLocation, routeRevision])

  useEffect(() => {
    if (!roadLocation || coursePlaces.length === 0) { setRoadRoutes(new Map()); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const results = await Promise.allSettled(coursePlaces.slice(0, 5).map(async (place) => {
        const response = await searchRoute({ origin: roadLocation, stops: [{ lat: place.lat, lng: place.lng }], transport: 'car' }, controller.signal)
        return [place.id, { distanceMeters: response.data.distanceMeters, durationSeconds: response.data.durationSeconds }] as const
      }))
      if (controller.signal.aborted) return
      const next = new Map<string, RoadRouteMetric>()
      results.forEach((result) => { if (result.status === 'fulfilled') next.set(result.value[0], result.value[1]) })
      setRoadRoutes(next)
    }, 700)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [coursePlaces, roadLocation])

  if (!req) {
    return <main className="app-shell result-shell"><section className="search-feedback form-error" role="alert"><span>추천 조건을 복원하지 못했습니다. 지역과 여행 조건을 다시 선택해 주세요.</span><Link to="/" className="ghost-button">조건 설정으로 이동</Link></section></main>
  }

  return (
    <main className="app-shell result-shell result-booking-shell">
      {tripNotice && <div className={`trip-toast ${tripNotice.kind}`} role="status" aria-live="polite">{tripNotice.text}</div>}
      <header className="result-booking-header">
        <Link to="/" className="booking-brand"><span className="booking-brand-mark">갈</span><span>갈래말래</span></Link>
        <nav className="result-breadcrumb" aria-label="현재 위치"><Link to="/">맞춤 코스</Link><span>/</span><strong>추천 결과</strong></nav>
        <div className="result-top-actions">
          {!isManualCourseEditing && <><button type="button" className="ghost-button result-share-button" disabled={tripActionBusy} onClick={() => saveCourse(true)}><Icon name="arrow" size={13} /> 공유</button>
          <button type="button" className="ghost-button result-share-button" disabled={tripActionBusy} onClick={() => saveCourse(false)}>내 코스 저장</button></>}
          <Link to="/saved" className="saved-count">♡ 찜한 장소 {favorites.length}</Link>
          <Link to="/trips" className="saved-count">내 코스 {trips.length}</Link>
          <Link to="/" className="back-button">조건 다시 설정</Link>
          <AuthActions />
        </div>
      </header>
      <section className="result-intro result-booking-hero">
        <div><div className="eyebrow">SEOUL PLACE EXPLORE</div><h1><em>{req.start}</em> 추천 장소</h1><p>{companionLabels[req.companion]}와 함께하는 {dateLabel(req.dateStart)} — {dateLabel(req.dateEnd)} 일정이에요. 결과에서 테마와 예산을 골라보세요.</p></div>
      </section>
      <section className="result-summary-bar" aria-label="선택한 여행 조건">
        <div><Icon name="pin" size={18} /><span>여행 지역<small>{req.start}</small></span></div>
        <div><Icon name="calendar" size={18} /><span>여행 일정<small>{dateLabel(req.dateStart)} — {dateLabel(req.dateEnd)}</small></span></div>
        <div><Icon name="users" size={18} /><span>동행<small>{companionLabels[req.companion]} · {req.headcount}명</small></span></div>
      </section>
      <section className="result-layout">
        <div className="itinerary-column">
          <div className="section-heading"><div><span className="step-label">RECOMMENDED ROUTE</span><h2>당신을 위한 맞춤 코스</h2></div><span className="result-count">{scored.length}개의 장소를 찾았어요</span></div>
          {apiError && <div className="search-feedback form-error"><span>{apiError}</span><button type="button" className="ghost-button" onClick={() => setSearchRevision((value) => value + 1)}>다시 시도</button></div>}
          <div className="result-filter-bar">
            <div className="tag-list" aria-label="장소 카테고리 필터">
              {searchCategories.map((item) => <button type="button" key={item.value} className={'tag-chip' + (draftTags.includes(item.value) ? ' active' : '')} onClick={() => setDraftTags((current) => current.includes(item.value) ? current.filter((tag) => tag !== item.value) : [...current, item.value])}>{item.label}</button>)}
            </div>
            <label className="result-budget-filter">1인 전체 예산 <input type="text" inputMode="numeric" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value.replace(/[^0-9]/g, ''))} placeholder="금액 입력" aria-label="1인 전체 여행 예산" /><span>원</span></label>
            <button type="button" className="result-filter-apply" onClick={applyFilters}>적용</button>
            <select className="result-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬 기준">
              {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            <div className="result-pref-row" aria-label="세부 여행 조건">
              <div className="booking-companions" aria-label="누구와 가나요?">
                {companions.map((item) => <button type="button" key={item.value} className={req.companion === item.value ? 'active' : ''} onClick={() => updateReq('companion', item.value)}><Icon name={item.icon} size={17} /><span><strong>{item.label}</strong><small>{item.caption}</small></span></button>)}
              </div>
              <label>인원 <input type="number" min="1" max="100" value={req.headcount} onChange={(event) => updateReq('headcount', Math.max(1, Math.min(100, Number(event.target.value) || 1)))} />명</label>
              <label>1인 예산 <input type="text" inputMode="numeric" value={String(req.budgetPerPerson)} onChange={(event) => updateReq('budgetPerPerson', Number(event.target.value.replace(/[^0-9]/g, '')) || 0)} />원</label>
              <div className="tag-list" aria-label="여행 취향">
                {tasteOptions.map((taste) => <button type="button" key={taste.value} className={'tag-chip' + (req.likes.includes(taste.value) ? ' active' : '')} onClick={() => updateReq('likes', req.likes.includes(taste.value) ? req.likes.filter((value) => value !== taste.value) : [...req.likes, taste.value])}>{taste.label}</button>)}
              </div>
            </div>
          </div>
          {filterError && <p className="result-filter-error" role="alert">{filterError}</p>}
          {budgetFilter > 0 && <p className="result-filter-status" aria-live="polite">1인 전체 예산 {budgetFilter.toLocaleString()}원 · 교통비 {transportBudget.toLocaleString()}원을 제외한 장소를 추천해요.</p>}
          <label className="place-search-input"><Icon name="pin" size={15} /><input value={keyword} onChange={(event) => { setApiPlaces([]); setHasMore(false); setSearchPage(1); setKeyword(event.target.value) }} placeholder="장소 또는 키워드로 검색" aria-label="장소 검색" />{keyword && <button type="button" onClick={() => { setApiPlaces([]); setHasMore(false); setSearchPage(1); setKeyword('') }} aria-label="검색어 지우기">×</button>}</label>
          <div className="day-tabs">{Array.from({ length: dayCount }).map((_, index) => <button type="button" key={index} onClick={() => setDay(index)} className={day === index ? 'selected' : ''}><span>DAY {index + 1}</span><small>{index === 0 ? dateLabel(req.dateStart) : '다음 날'}</small></button>)}</div>
          <div className="route-card">
            <div className="route-card-top"><div><span className="route-kicker">DAY {day + 1} · {dateLabel(day === 0 ? req.dateStart : req.dateEnd)}</span><h3>오늘은 {req.start === '서울' ? '서울 곳곳' : req.start}에서 놀아보세요</h3></div><span className="route-weather"><Icon name={weather.icon} size={13} /> {weather.temp}</span></div>
            <div className={'gps-distance-status' + (liveLocation ? ' is-live' : '')}>{liveLocation ? <><i /> 내 GPS 위치 기준 · 정확도 ±{Math.max(1, liveLocation.accuracy)}m</> : 'GPS 위치를 확인하는 중이에요.'}</div>
            <div className="route-summary">{route ? <><strong>실시간 빠른 차량 경로</strong><span>{(route.distanceMeters / 1000).toFixed(1)}km · 약 {Math.max(1, Math.round(route.durationSeconds / 60))}분</span></> : <><span>{routeStatus || '장소를 고르면 빠른 경로를 계산해요.'}</span>{req.transport === 'car' && routeStatus.includes('불러오지') && <button type="button" className="ghost-button" onClick={() => setRouteRevision((value) => value + 1)}>다시 시도</button>}</>}</div>
            <div className="timeline">{currentCourse.length === 0 && <p className="empty-route">조건에 맞는 장소가 없어요. 취향을 조금만 바꿔볼까요?</p>}{currentCourse.map((stop, index) => { const road = roadRoutes.get(stop.place.id); return <div className={'timeline-item' + (dragOverIndex === index ? ' drag-over' : '')} key={stop.place.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={() => handleDrop(index)} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }} style={{ cursor: 'grab', opacity: dragIndex === index ? 0.4 : 1, transition: 'opacity .15s, background .15s' }}><div className="timeline-time">{stop.time}</div><div className="timeline-line"><span className="timeline-dot"><Icon name={categoryIcons[stop.place.category]} size={14} /></span>{index < currentCourse.length - 1 && <i />}</div><div className="timeline-content"><strong>{stop.place.name}</strong><span>{stop.place.area} · {stop.place.description}</span><small className="timeline-gps-distance">{!liveLocation ? 'GPS 위치를 가져오는 중이에요.' : road ? `내 위치에서 ${formatGpsDistance(road.distanceMeters)} · 약 ${Math.max(1, Math.round(road.durationSeconds / 60))}분 · 차량 빠른길` : '차량 빠른길을 계산하는 중이에요.'}</small></div></div> })}</div>
          </div>
          <div className="section-heading place-heading"><div><h2>추천 장소</h2>{isManualCourseEditing && <small className="manual-course-hint">직접 코스에 {persistedCourseDays.flat().length}곳을 담았어요. 카드에서 추가하거나 제거할 수 있어요.</small>}</div><div className="manual-course-actions">{isManualCourseEditing ? <><button type="button" className="ghost-button" onClick={cancelManualCourse} disabled={tripActionBusy}>취소</button><button type="button" className="primary-button" onClick={() => void completeManualCourse()} disabled={tripActionBusy}>{tripActionBusy ? '저장 중...' : '완료하고 저장'}</button></> : <button type="button" className="primary-button" onClick={startManualCourse}>코스 직접 짜기</button>}<span className="result-count">현재 {recommended.length}곳 표시</span></div></div>
          <div className="ai-insight"><Icon name="spark" size={20} /><div><strong>필터로 원하는 장소만 둘러보세요</strong><p>선택한 테마에 맞는 실제 장소만 목록과 지도에 표시합니다.</p></div></div>
          {loading ? (
            <div className="place-list"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : (
            <><div className="place-list">{recommended.map((item, index) => <PlaceCard key={item.place.id} index={index + 1} scored={item} onSelect={setSelectedPlaceId} onRemove={(id) => setExcluded((current) => [...current, id])} isSaved={isFavorite(item.place.id)} onToggleSaved={() => toggleFavorite(item.place)} inCourse={isManualCourseEditing && isInManualCourse(item.place.id)} onCourseToggle={isManualCourseEditing ? () => toggleManualPlace(item.place) : undefined} onReviewSummary={({ placeId, rating, reviewCount }) => setApiPlaces((current) => current.map((place) => place.id === placeId ? { ...place, rating, reviewCount } : place))} />)}</div>{hasMore && <button type="button" className="result-load-more" onClick={() => setSearchPage((value) => value + 1)} disabled={loading}>{loading ? '장소를 불러오는 중...' : '장소 더보기'}</button>}</>
          )}
          <div className="budget-card"><div className="budget-header"><div><span className="step-label">ESTIMATED COST</span><h2>예상 여행 비용</h2></div><span className="budget-person">1인 기준</span></div><div className="budget-content"><div className="budget-total"><strong>{budget.perPerson.toLocaleString()}<small>원</small></strong>{budgetFilter > 0 ? <><span>예산의 {Math.min(999, Math.round((budget.perPerson / budgetFilter) * 100))}% 사용</span><div className="budget-progress"><i style={{ width: Math.min(100, (budget.perPerson / budgetFilter) * 100) + '%' }} /></div></> : <span>예산을 입력하면 한도 안의 코스를 추천해요.</span>}</div><div className="budget-breakdown">{budget.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.cost.toLocaleString()}원</strong></div>)}</div></div></div>
        </div>
        <aside className="map-column"><div className="map-card"><div className="map-live-badge"><i /> KAKAO LIVE</div><MapView places={mapPlaces} center={center} userLocation={liveLocation ?? userLocation} selectedPlaceId={selectedPlaceId} onPlaceSelect={setSelectedPlaceId} /><div className="map-legend"><span><i className="legend-dot green" /> 서비스 후기 평균 TOP 1~3</span></div></div><div className="side-tip"><Icon name="spark" size={20} /><div><strong>필터와 지도가 함께 바뀌어요</strong><p>카테고리를 선택하거나 해제하면 목록과 마커가 즉시 갱신됩니다.</p></div></div></aside>
      </section>
      <footer className="home-footer">© 2026 갈래말래 · 서울에서 발견하는 나만의 하루</footer>
      <BottomNav />
    </main>
  )
}
