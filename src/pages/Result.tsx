import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { searchPlaces, searchRoute, type RouteResponse } from '../lib/placesApi'
import { buildItineraries, estimateBudget, recommend, type ScoredPlace, type ItineraryStop } from '../lib/scoring'
import { useFavorites } from '../favorites/FavoritesContext'
import type { Place, Tag, TripRequest } from '../types'
import Icon, { type IconName } from '../components/Icon'
import MapView from '../components/MapView'
import PlaceCard from '../components/PlaceCard'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'

const companionLabels = { friends: '친구', couple: '연인', family: '가족', alone: '혼자' }
const weatherLabels: Record<TripRequest['weather'], { icon: IconName; label: string; temp: string; rain: string }> = { sunny: { icon: 'sun', label: '맑음', temp: '27°', rain: '강수확률 10%' }, cloudy: { icon: 'cloud', label: '구름 조금', temp: '25°', rain: '강수확률 20%' }, rain: { icon: 'rain', label: '비', temp: '22°', rain: '강수확률 70%' } }
const categoryIcons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }
const searchCategories: { value: Tag; label: string }[] = [
  { value: 'cafe', label: '카페' }, { value: 'foodie', label: '맛집' }, { value: 'nature', label: '자연' },
  { value: 'activity', label: '액티비티' }, { value: 'shopping', label: '쇼핑' }, { value: 'rest', label: '휴식' },
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
    p: places.map((p) => p.id).join(','),
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
  const rawReq = location.state as (TripRequest & { _fromSaved?: boolean; _savedPlaces?: Place[] }) | null
  const req = rawReq as TripRequest | null
  const fromSaved = Boolean(rawReq?._fromSaved && rawReq?._savedPlaces?.length)
  const savedPlacesForCourse = rawReq?._savedPlaces || []
  const [excluded, setExcluded] = useState<string[]>([])
  const [day, setDay] = useState(0)
  const [selectedTags, setSelectedTags] = useState<Tag[]>([])
  const [budgetFilter, setBudgetFilter] = useState(50000)
  const [budgetInput, setBudgetInput] = useState('50000')
  const [sort, setSort] = useState<SortKey>('score')
  const [apiPlaces, setApiPlaces] = useState<Place[]>([])
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(true)
  const [searchPage, setSearchPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchRevision, setSearchRevision] = useState(0)
  const [recommendationSeed] = useState(() => Math.random())
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>()
  const [route, setRoute] = useState<RouteResponse['data'] | null>(null)
  const [routeStatus, setRouteStatus] = useState('')
  const [routeRevision, setRouteRevision] = useState(0)
  const { favorites, isFavorite, toggleFavorite } = useFavorites()
  const [customCourse, setCustomCourse] = useState<ItineraryStop[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isCustomMode, setIsCustomMode] = useState(false)
  const dayCount = req ? daysBetween(req.dateStart, req.dateEnd) : 1

  // Budget only changes the local ranking, so typing never causes place API calls.
  // The short debounce prevents recalculating the complete list for every digit.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = Number(budgetInput)
      if (Number.isFinite(next) && next > 0) setBudgetFilter(Math.floor(next))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [budgetInput])

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition((position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }), undefined, { enableHighAccuracy: true, maximumAge: 30000 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (!req) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setApiError('')
      setLoading(true)
      const origin = userLocation ?? { lat: 37.5668, lng: 126.978 }
      searchPlaces({ area: req.start, companion: req.companion, q: keyword.trim(), tags: selectedTags, includeLodging: false, page: searchPage, limit: 20, lat: origin.lat, lng: origin.lng, radius: 6_000 }, controller.signal)
      .then(({ data, meta }) => {
        setApiPlaces((current) => searchPage === 1 ? data : [...current, ...data.filter((place) => !current.some((existing) => existing.id === place.id))])
        setHasMore(Boolean(meta.hasMore) && data.length > 0)
        if (data.length === 0) setApiError('이 조건과 지도 영역에서 찾은 장소가 없어요. 검색어 또는 지도를 바꿔보세요.')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.error('places fetch failed', error)
        const msg = error instanceof Error && error.message ? error.message : '카카오 장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'
        setApiError(msg === 'Failed to fetch' ? '서버가 깨어나는 중이에요. 3초 후 자동 재시도합니다.' : msg)
        // 첫 로드에서 실패해도 기존 데이터가 없으면 자동 재시도 (Render 슬립 대응)
        if (searchPage === 1) {
          window.setTimeout(() => setSearchRevision((v) => v + 1), 3000)
        }
      })
      .finally(() => setLoading(false))
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [req, selectedTags, userLocation, keyword, searchRevision, searchPage])

  const filterRequest = useMemo(() => req ? { ...req, likes: selectedTags, budgetPerPerson: budgetFilter } : null, [req, selectedTags, budgetFilter])
  const scoredFromSaved = useMemo(() => {
    if (!fromSaved) return null
    return savedPlacesForCourse.map((place) => ({ place, score: 100, fitScore: 100, detail: [], reasons: ['담아둔 곳'] } as unknown as ScoredPlace))
  }, [fromSaved, savedPlacesForCourse])
  const scored = useMemo(() => {
    if (scoredFromSaved) return scoredFromSaved
    return filterRequest ? recommend(apiPlaces, filterRequest, excluded, recommendationSeed) : []
  }, [filterRequest, apiPlaces, excluded, recommendationSeed, scoredFromSaved])
  const sortedScored = useMemo(() => sortScored(scored, sort), [scored, sort])
  const itineraries = useMemo(() => {
    if (fromSaved) {
      // 담아둔 곳을 그대로 일정으로 — 하루에 5곳씩 나눠 담기
      const stops: ItineraryStop[] = savedPlacesForCourse.map((place, i) => ({
        time: `${String(10 + Math.floor(i % 5) * 2).padStart(2,'0')}:00`,
        emoji: place.category === 'food' ? '🍽️' : place.category === 'cafe' ? '☕' : place.category === 'activity' ? '🎡' : '🌤️',
        place,
      }))
      const perDay = 5
      const days: ItineraryStop[][] = []
      for (let d = 0; d < dayCount; d++) days.push(stops.slice(d * perDay, (d + 1) * perDay))
      // 남은 날은 빈 배열로
      while (days.length < dayCount) days.push([])
      return days
    }
    return req ? buildItineraries(scored, req, dayCount, recommendationSeed) : []
  }, [scored, req, dayCount, recommendationSeed, fromSaved, savedPlacesForCourse])
  const rawCurrentCourse = itineraries[day] ?? []
  const currentCourse = isCustomMode ? customCourse : (customCourse.length > 0 && customCourse.length === rawCurrentCourse.length ? customCourse : rawCurrentCourse)

  const addToCustomCourse = useCallback((place: Place) => {
    setIsCustomMode(true)
    setCustomCourse((prev) => {
      if (prev.some((s) => s.place.id === place.id)) return prev
      const time = `${String(10 + Math.floor(prev.length * 1.5)).padStart(2,'0')}:00`
      const emoji = place.category === 'food' ? '🍽️' : place.category === 'cafe' ? '☕' : place.category === 'activity' ? '🎡' : '🌤️'
      return [...prev, { time, emoji, place }]
    })
  }, [])
  const removeFromCustomCourse = useCallback((placeId: string) => {
    setCustomCourse((prev) => prev.filter((s) => s.place.id !== placeId))
  }, [])
  const clearCustomCourse = useCallback(() => {
    setCustomCourse([])
    setIsCustomMode(false)
  }, [])

  const handleDragStart = useCallback((index: number) => { setDragIndex(index) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index) }, [])
  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return }
    const source = isCustomMode ? customCourse : rawCurrentCourse
    const updated = [...source]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setCustomCourse(updated)
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, rawCurrentCourse, customCourse, isCustomMode])

  useEffect(() => { setCustomCourse([]) }, [day])
  const allCourse = useMemo(() => {
    const seen = new Set<string>()
    return itineraries.flat().filter((stop) => {
      if (seen.has(stop.place.id)) return false
      seen.add(stop.place.id)
      return true
    }).map((stop) => scored.find((item) => item.place.id === stop.place.id)).filter(Boolean) as typeof scored
  }, [itineraries, scored])
  const budget = useMemo(() => req ? estimateBudget(req, allCourse) : { items: [], total: 0, perPerson: 0 }, [req, allCourse])
  const coursePlaces = useMemo(() => currentCourse.map((stop) => stop.place), [currentCourse])
  // Explore results are not capped at eight. Additional API pages are appended
  // through the “더보기” button below; every request remains limited to 20.
  const recommended = sortedScored
  const recommendedPlaces = recommended.map((item) => item.place)
  const mapPlaces = (recommendedPlaces.length > 0 ? recommendedPlaces : coursePlaces).filter((place) => place.category !== 'lodging').slice(0, 40)
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
      searchRoute({ origin, stops: coursePlaces.slice(0, 20).map(({ lat, lng }) => ({ lat, lng })), transport: 'car' }, controller.signal)
        .then(({ data }) => { setRoute(data); setRouteStatus('') })
        .catch(() => { setRoute(null); setRouteStatus('실시간 차량 경로를 불러오지 못했어요.') })
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [req, coursePlaces, userLocation, routeRevision])

  if (!req) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="app-shell result-shell result-booking-shell">
      <header className="result-booking-header">
        <Link to="/" className="booking-brand"><span className="booking-brand-mark">갈</span><span>갈래말래</span></Link>
        <nav className="result-breadcrumb" aria-label="현재 위치"><Link to="/">맞춤 코스</Link><span>/</span><strong>추천 결과</strong></nav>
        <div className="result-top-actions">
          <button type="button" className="ghost-button result-share-button" onClick={() => shareCourse(req, coursePlaces)}><Icon name="arrow" size={13} /> 공유</button>
          <Link to="/saved" className="saved-count">♡ 저장한 코스 {favorites.length}</Link>
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
          <div className="section-heading"><div><span className="step-label">RECOMMENDED ROUTE</span><h2>당신을 위한 맞춤 코스</h2></div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="result-count">{isCustomMode ? `${customCourse.length}곳 직접 선택` : `${scored.length}개의 장소를 찾았어요`}</span>
              <button type="button" className="ghost-button" style={{ fontSize:11, padding:'6px 10px', background: isCustomMode ? '#2878f0' : '#fff', color: isCustomMode ? '#fff' : '#5a6d8a', borderColor: isCustomMode ? '#2878f0' : '#e2e6e0' }} onClick={() => { if (isCustomMode) clearCustomCourse(); else { setIsCustomMode(true); if (rawCurrentCourse.length>0) setCustomCourse(rawCurrentCourse) } }}>{isCustomMode ? '자동 코스' : '직접 짜기'}</button>
            </div>
          </div>
          {isCustomMode && (
            <div style={{ display:'flex', gap:8, marginBottom:12, padding:'10px', background:'#f0f7ff', border:'1px solid #dbe4f0', borderRadius:10, fontSize:11, color:'#3a5a8a' }}>
              <span>👆 아래 추천 장소에서 <strong>담기</strong>를 눌러 직접 코스를 만들어보세요. 드래그로 순서도 바꿀 수 있어요.</span>
              {customCourse.length>0 && <button type="button" className="ghost-button" style={{ marginLeft:'auto', fontSize:10, padding:'4px 8px' }} onClick={clearCustomCourse}>초기화</button>}
            </div>
          )}
          {apiError && <div className="search-feedback form-error"><span>{apiError}</span><button type="button" className="ghost-button" onClick={() => setSearchRevision((value) => value + 1)}>다시 시도</button></div>}
          <div className="result-filter-bar">
            <div className="tag-list" aria-label="장소 카테고리 필터">
              {searchCategories.map((item) => <button type="button" key={item.value} className={'tag-chip' + (selectedTags.includes(item.value) ? ' active' : '')} onClick={() => { setApiPlaces([]); setHasMore(false); setSearchPage(1); setSelectedTags((current) => current.includes(item.value) ? current.filter((tag) => tag !== item.value) : [...current, item.value]); setDay(0) }}>{item.label}</button>)}
            </div>
            <label className="result-budget-filter">1인 예산 <span><input type="number" min="1" step="1000" inputMode="numeric" value={budgetInput} onChange={(event) => setBudgetInput(event.target.value.replace(/[^0-9]/g, ''))} aria-label="1인 예산" />원</span>{budgetInput !== '' && Number(budgetInput) > 0 ? <small>{Number(budgetInput).toLocaleString()}원</small> : <small>1원 이상 입력</small>}</label>
            <select className="result-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="정렬 기준">
              {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <label className="place-search-input"><Icon name="pin" size={15} /><input value={keyword} onChange={(event) => { setApiPlaces([]); setHasMore(false); setSearchPage(1); setKeyword(event.target.value) }} placeholder="장소 또는 키워드로 검색" aria-label="장소 검색" />{keyword && <button type="button" onClick={() => { setApiPlaces([]); setHasMore(false); setSearchPage(1); setKeyword('') }} aria-label="검색어 지우기">×</button>}</label>
          <div className="day-tabs">{Array.from({ length: dayCount }).map((_, index) => <button type="button" key={index} onClick={() => setDay(index)} className={day === index ? 'selected' : ''}><span>DAY {index + 1}</span><small>{index === 0 ? dateLabel(req.dateStart) : '다음 날'}</small></button>)}</div>
          <div className="route-card">
            <div className="route-card-top"><div><span className="route-kicker">DAY {day + 1} · {dateLabel(day === 0 ? req.dateStart : req.dateEnd)}</span><h3>오늘은 {req.start === '서울' ? '서울 곳곳' : req.start}에서 놀아보세요</h3></div><span className="route-weather"><Icon name={weather.icon} size={13} /> {weather.temp}</span></div>
            <div className="route-summary">{route ? <><strong>실시간 차량 경로</strong><span>{(route.distanceMeters / 1000).toFixed(1)}km · 약 {Math.max(1, Math.round(route.durationSeconds / 60))}분</span></> : <><span>{routeStatus || '장소를 고르면 실시간 경로를 계산해요.'}</span>{req.transport === 'car' && routeStatus.includes('불러오지') && <button type="button" className="ghost-button" onClick={() => setRouteRevision((value) => value + 1)}>다시 시도</button>}</>}</div>
            <div className="timeline">
              {isCustomMode && customCourse.length === 0 && <p className="empty-route">담은 장소가 없어요. 아래에서 장소를 담아보세요.</p>}
              {!isCustomMode && currentCourse.length === 0 && <p className="empty-route">조건에 맞는 장소가 없어요. 취향을 조금만 바꿔볼까요?</p>}
              {currentCourse.map((stop, index) => <div className={'timeline-item' + (dragOverIndex === index ? ' drag-over' : '')} key={stop.place.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={() => handleDrop(index)} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }} style={{ cursor: 'grab', opacity: dragIndex === index ? 0.4 : 1, transition: 'opacity .15s, background .15s' }}><div className="timeline-time">{stop.time}</div><div className="timeline-line"><span className="timeline-dot"><Icon name={categoryIcons[stop.place.category]} size={14} /></span>{index < currentCourse.length - 1 && <i />}</div><div className="timeline-content"><strong>{stop.place.name}</strong><span>{stop.place.area} · {stop.place.description}</span>{isCustomMode ? <button type="button" className="ghost-button" style={{ marginTop:6, fontSize:10, padding:'3px 7px', minHeight:24 }} onClick={() => removeFromCustomCourse(stop.place.id)}>빼기</button> : (index < currentCourse.length - 1 && <small>다음 장소까지 약 {index % 2 === 0 ? 12 : 8}분</small>)}</div></div>)}</div>
            {isCustomMode && (
              <div className="custom-complete-bar" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14, paddingTop:12, borderTop:'1px solid #eef2f7' }}>
                <span style={{ color:'#6f7b91', fontSize:11 }}>{customCourse.length > 0 ? `${customCourse.length}곳 담김 · 수정 후 완료를 눌러 적용하세요` : '장소를 담아보세요'}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (customCourse.length === 0) { alert('담은 장소가 없어요. 장소를 담아보세요.'); return }
                    // 완료 시 적용 - 현재 customCourse가 그대로 유지되며 토스트로 확인
                    const ok = window.confirm(`${customCourse.length}곳 코스를 완료할까요? 완료하면 이대로 적용됩니다.`)
                    if (ok) {
                      // isCustomMode 유지, 완료 상태로 저장(간단히 로컬스토리지에 백업)
                      try { localStorage.setItem('where:customCourse', JSON.stringify(customCourse.map(s=>s.place.id))); localStorage.setItem('where:customCourseDay', String(day)) } catch {}
                      alert('완료! 직접 짠 코스로 적용되었습니다.')
                    }
                  }}
                  disabled={customCourse.length === 0}
                  className="primary-button"
                  style={{ minHeight:34, padding:'0 16px', fontSize:12, background: customCourse.length===0 ? '#c9d1de' : '#2878f0', cursor: customCourse.length===0 ? 'not-allowed' : 'pointer' }}
                >
                  완료
                </button>
              </div>
            )}
          </div>
          <div className="section-heading place-heading"><div><h2>추천 장소</h2></div><span className="result-count">현재 {recommended.length}곳 표시</span></div>
          <div className="ai-insight"><Icon name="spark" size={20} /><div><strong>필터로 원하는 장소만 둘러보세요</strong><p>선택한 테마에 맞는 실제 장소만 목록과 지도에 표시합니다.</p></div></div>
          {loading ? (
            <div className="place-list"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : (
            <><div className="place-list">{recommended.map((item, index) => <PlaceCard key={item.place.id} index={index + 1} scored={item} onSelect={setSelectedPlaceId} onRemove={(id) => setExcluded((current) => [...current, id])} onAdd={addToCustomCourse} isCustomMode={isCustomMode} isAdded={customCourse.some((s) => s.place.id === item.place.id)} isSaved={isFavorite(item.place.id)} onToggleSaved={() => toggleFavorite(item.place)} />)}</div>{hasMore && <button type="button" className="result-load-more" onClick={() => setSearchPage((value) => value + 1)} disabled={loading}>{loading ? '장소를 불러오는 중...' : '장소 더보기'}</button>}</>
          )}
          <div className="budget-card"><div className="budget-header"><div><span className="step-label">ESTIMATED COST</span><h2>예상 여행 비용</h2></div><span className="budget-person">1인 기준</span></div><div className="budget-content"><div className="budget-total"><strong>{budget.perPerson.toLocaleString()}<small>원</small></strong><span>예산의 {Math.min(999, Math.round((budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100))}% 사용</span><div className="budget-progress"><i style={{ width: Math.min(100, (budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100) + '%' }} /></div></div><div className="budget-breakdown">{budget.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.cost.toLocaleString()}원</strong></div>)}</div></div></div>
        </div>
        <aside className="map-column"><div className="map-card"><div className="map-live-badge"><i /> KAKAO LIVE</div><MapView places={mapPlaces} center={center} userLocation={userLocation} selectedPlaceId={selectedPlaceId} onPlaceSelect={setSelectedPlaceId} /><div className="map-legend"><span><i className="legend-dot green" /> 현재 필터에 맞는 장소</span></div></div><div className="side-tip"><Icon name="spark" size={20} /><div><strong>필터와 지도가 함께 바뀌어요</strong><p>카테고리를 선택하거나 해제하면 목록과 마커가 즉시 갱신됩니다.</p></div></div></aside>
      </section>
      <footer className="home-footer">© 2026 갈래말래 · 서울에서 발견하는 나만의 하루</footer>
      <BottomNav />
    </main>
  )
}
