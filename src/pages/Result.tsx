import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { searchPlaces, searchRoute, type RouteResponse } from '../lib/placesApi'
import { buildItineraries, estimateBudget, recommend, type ScoredPlace, type ItineraryStop } from '../lib/scoring'
import { getSavedPlaces, toggleSavedPlace } from '../lib/savedPlaces'
import type { Category, Place, TripRequest } from '../types'
import Icon, { type IconName } from '../components/Icon'
import MapView from '../components/MapView'
import PlaceCard from '../components/PlaceCard'
import AuthActions from '../components/AuthActions'
import WeatherWidget from '../components/WeatherWidget'
import BottomNav from '../components/BottomNav'

const companionLabels = { friends: '친구', couple: '연인', family: '가족', alone: '혼자' }
const weatherLabels: Record<TripRequest['weather'], { icon: IconName; label: string; temp: string; rain: string }> = { sunny: { icon: 'sun', label: '맑음', temp: '27°', rain: '강수확률 10%' }, cloudy: { icon: 'cloud', label: '구름 조금', temp: '25°', rain: '강수확률 20%' }, rain: { icon: 'rain', label: '비', temp: '22°', rain: '강수확률 70%' } }
const categoryIcons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }
const searchCategories: { value?: Category; label: string }[] = [
  { label: '전체' }, { value: 'food', label: '맛집' }, { value: 'cafe', label: '카페' },
  { value: 'tour', label: '관광지' }, { value: 'lodging', label: '숙소' }, { value: 'activity', label: '액티비티' },
]
type SortKey = 'score' | 'rating' | 'price-asc' | 'price-desc'
const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'score', label: '추천순' }, { value: 'rating', label: '평점순' },
  { value: 'price-asc', label: '가격 낮은순' }, { value: 'price-desc', label: '가격 높은순' },
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
    case 'price-asc': return sorted.sort((a, b) => a.place.price - b.place.price)
    case 'price-desc': return sorted.sort((a, b) => b.place.price - a.place.price)
    default: return sorted
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
  const req = location.state as TripRequest | null
  const [excluded, setExcluded] = useState<string[]>([])
  const [day, setDay] = useState(0)
  const [category, setCategory] = useState<Category | undefined>()
  const [sort, setSort] = useState<SortKey>('score')
  const [apiPlaces, setApiPlaces] = useState<Place[]>([])
  const [apiError, setApiError] = useState('')
  const [loading, setLoading] = useState(true)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [viewport, setViewport] = useState<{ lat: number; lng: number; radius: number } | null>(null)
  const [keyword, setKeyword] = useState('')
  const [searchRevision, setSearchRevision] = useState(0)
  const [route, setRoute] = useState<RouteResponse['data'] | null>(null)
  const [routeStatus, setRouteStatus] = useState('')
  const [routeRevision, setRouteRevision] = useState(0)
  const [savedPlaces, setSavedPlaces] = useState(getSavedPlaces)
  const [customCourse, setCustomCourse] = useState<ItineraryStop[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

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
      const origin = viewport ?? userLocation ?? { lat: 37.5668, lng: 126.978 }
      searchPlaces({ area: viewport ? '' : req.start, category, companion: req.companion, q: keyword.trim(), limit: 60, lat: origin.lat, lng: origin.lng, radius: viewport?.radius ?? 8000 }, controller.signal)
      .then(({ data }) => {
        setApiPlaces(data)
        if (data.length === 0) setApiError('이 조건과 지도 영역에서 찾은 장소가 없어요. 검색어 또는 지도를 바꿔보세요.')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setApiPlaces([])
        setApiError('카카오 장소 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.')
      })
      .finally(() => setLoading(false))
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [req, category, userLocation, viewport, keyword, searchRevision])

  const dayCount = req ? daysBetween(req.dateStart, req.dateEnd) : 1
  const scored = useMemo(() => req ? recommend(apiPlaces, req, excluded) : [], [req, apiPlaces, excluded])
  const sortedScored = useMemo(() => sortScored(scored, sort), [scored, sort])
  const itineraries = useMemo(() => buildItineraries(scored, dayCount), [scored, dayCount])
  const rawCurrentCourse = itineraries[day] ?? []
  const currentCourse = customCourse.length > 0 && customCourse.length === rawCurrentCourse.length ? customCourse : rawCurrentCourse

  const handleDragStart = useCallback((index: number) => { setDragIndex(index) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index) }, [])
  const handleDrop = useCallback((index: number) => {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return }
    const updated = [...rawCurrentCourse]
    const [moved] = updated.splice(dragIndex, 1)
    updated.splice(index, 0, moved)
    setCustomCourse(updated)
    setDragIndex(null)
    setDragOverIndex(null)
  }, [dragIndex, rawCurrentCourse])

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
  const recommended = sortedScored.slice(0, 8)
  const recommendedPlaces = recommended.map((item) => item.place)
  const mapPlaces = recommendedPlaces.length > 0 ? recommendedPlaces : coursePlaces
  const center: [number, number] = mapPlaces[0] ? [mapPlaces[0].lat, mapPlaces[0].lng] : [37.5668, 126.978]
  const weather = req ? weatherLabels[req.weather] : weatherLabels.sunny

  const handleViewportChange = useCallback((next: { lat: number; lng: number; radius: number }) => {
    setViewport((current) => current && Math.abs(current.lat - next.lat) < 0.0002 && Math.abs(current.lng - next.lng) < 0.0002 && current.radius === next.radius ? current : next)
  }, [])

  useEffect(() => {
    if (!req || coursePlaces.length === 0) { setRoute(null); return }
    if (req.transport !== 'car') {
      setRoute(null)
      setRouteStatus('대중교통 실시간 경로는 준비 중입니다. 장소 카드에서 카카오맵 길찾기를 이용해주세요.')
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRouteStatus('실시간 차량 경로를 계산하는 중이에요.')
      const origin = userLocation ?? viewport ?? { lat: coursePlaces[0].lat, lng: coursePlaces[0].lng }
      searchRoute({ origin, stops: coursePlaces.slice(0, 5).map(({ lat, lng }) => ({ lat, lng })), transport: 'car' }, controller.signal)
        .then(({ data }) => { setRoute(data); setRouteStatus('') })
        .catch(() => { setRoute(null); setRouteStatus('실시간 차량 경로를 불러오지 못했어요.') })
    }, 400)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [req, coursePlaces, userLocation, viewport, routeRevision])

  if (!req) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="app-shell result-shell">
      <header className="topbar result-topbar">
        <Link to="/" className="brand"><span className="brand-mark">W</span><span>어디갈까<span className="brand-dot">.</span></span></Link>
        <div className="result-top-actions">
          <button type="button" className="ghost-button" style={{ flex: 'none', padding: '8px 12px', fontSize: 11 }} onClick={() => shareCourse(req, coursePlaces)}><Icon name="arrow" size={13} /> 공유</button>
          <Link to="/saved" className="saved-count">♡ 저장한 코스 {savedPlaces.length}</Link>
          <Link to="/" className="back-button">조건 다시 설정 <span>↗</span></Link>
          <AuthActions />
        </div>
      </header>
      <section className="result-intro">
        <div><div className="eyebrow">YOUR SEOUL, YOUR PLAN</div><h1><em>{req.start}</em>에서<br />이렇게 놀아보세요.</h1><p>{companionLabels[req.companion]} {req.headcount}명 · {dateLabel(req.dateStart)} — {dateLabel(req.dateEnd)} · 1인 {req.budgetPerPerson.toLocaleString()}원</p></div>
        <div className="result-weather-live"><WeatherWidget compact /></div>
      </section>
      <section className="result-layout">
        <div className="itinerary-column">
          <div className="section-heading"><div><span className="step-label">RECOMMENDED ROUTE</span><h2>당신을 위한 맞춤 코스</h2></div><span className="result-count">{scored.length}개의 장소를 찾았어요</span></div>
          {apiError && <div className="search-feedback form-error"><span>{apiError}</span><button type="button" className="ghost-button" onClick={() => setSearchRevision((value) => value + 1)}>다시 시도</button></div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div className="tag-list" aria-label="장소 카테고리 검색">
              {searchCategories.map((item) => <button type="button" key={item.label} className={'tag-chip' + (category === item.value ? ' active' : '')} onClick={() => { setCategory(item.value); setDay(0) }}>{item.label}</button>)}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ padding: '6px 10px', border: '1px solid #e2e7e1', borderRadius: 8, background: '#fff', color: '#646b65', fontSize: 11, cursor: 'pointer' }}>
              {sortOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <label className="place-search-input"><Icon name="pin" size={15} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="장소 또는 키워드로 검색" aria-label="장소 검색" />{keyword && <button type="button" onClick={() => setKeyword('')} aria-label="검색어 지우기">×</button>}</label>
          <div className="day-tabs">{Array.from({ length: dayCount }).map((_, index) => <button type="button" key={index} onClick={() => setDay(index)} className={day === index ? 'selected' : ''}><span>DAY {index + 1}</span><small>{index === 0 ? dateLabel(req.dateStart) : '다음 날'}</small></button>)}</div>
          <div className="route-card">
            <div className="route-card-top"><div><span className="route-kicker">DAY {day + 1} · {dateLabel(day === 0 ? req.dateStart : req.dateEnd)}</span><h3>오늘은 {req.start === '서울' ? '서울 곳곳' : req.start}에서 놀아보세요</h3></div><span className="route-weather"><Icon name={weather.icon} size={13} /> {weather.temp}</span></div>
            <div className="route-summary">{route ? <><strong>실시간 차량 경로</strong><span>{(route.distanceMeters / 1000).toFixed(1)}km · 약 {Math.max(1, Math.round(route.durationSeconds / 60))}분</span></> : <><span>{routeStatus || '장소를 고르면 실시간 경로를 계산해요.'}</span>{req.transport === 'car' && routeStatus.includes('불러오지') && <button type="button" className="ghost-button" onClick={() => setRouteRevision((value) => value + 1)}>다시 시도</button>}</>}</div>
            <div className="timeline">{currentCourse.length === 0 && <p className="empty-route">조건에 맞는 장소가 없어요. 취향을 조금만 바꿔볼까요?</p>}{currentCourse.map((stop, index) => <div className={'timeline-item' + (dragOverIndex === index ? ' drag-over' : '')} key={stop.place.id} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={() => handleDrop(index)} onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }} style={{ cursor: 'grab', opacity: dragIndex === index ? 0.4 : 1, transition: 'opacity .15s, background .15s' }}><div className="timeline-time">{stop.time}</div><div className="timeline-line"><span className="timeline-dot"><Icon name={categoryIcons[stop.place.category]} size={14} /></span>{index < currentCourse.length - 1 && <i />}</div><div className="timeline-content"><strong>{stop.place.name}</strong><span>{stop.place.area} · {stop.place.description}</span>{index < currentCourse.length - 1 && <small>다음 장소까지 약 {index % 2 === 0 ? 12 : 8}분</small>}</div></div>)}</div>
          </div>
          <div className="section-heading place-heading"><div><h2>지도 주변 맞춤 추천</h2></div><span className="result-count">상위 {recommended.length}곳을 추천해요</span></div>
          <div className="ai-insight"><Icon name="spark" size={20} /><div><strong>취향과 지도를 함께 분석했어요</strong><p>{req.start} 주변의 맛집·카페·숙소를 이동 거리와 평점까지 고려해 골랐어요.</p></div></div>
          {loading ? (
            <div className="place-list"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : (
            <div className="place-list">{recommended.map((item, index) => <PlaceCard key={item.place.id} index={index + 1} scored={item} onRemove={(id) => setExcluded((current) => [...current, id])} isSaved={savedPlaces.some((place) => place.id === item.place.id)} onToggleSaved={() => setSavedPlaces((current) => toggleSavedPlace(current, item.place))} />)}</div>
          )}
          <div className="budget-card"><div className="budget-header"><div><span className="step-label">ESTIMATED COST</span><h2>예상 여행 비용</h2></div><span className="budget-person">1인 기준</span></div><div className="budget-content"><div className="budget-total"><strong>{budget.perPerson.toLocaleString()}<small>원</small></strong><span>예산의 {Math.min(999, Math.round((budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100))}% 사용</span><div className="budget-progress"><i style={{ width: Math.min(100, (budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100) + '%' }} /></div></div><div className="budget-breakdown">{budget.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.cost.toLocaleString()}원</strong></div>)}</div></div></div>
        </div>
        <aside className="map-column"><div className="map-card"><MapView places={mapPlaces} routePlaces={coursePlaces} routeCoordinates={route?.coordinates} center={center} onViewportChange={handleViewportChange} /><div className="map-legend"><span><i className="legend-dot green" /> 추천 장소</span><span><i className="legend-line" /> {route ? '실시간 차량 경로' : '코스 연결선'}</span></div></div><div className="side-tip"><Icon name="spark" size={20} /><div><strong>지도를 움직여 새로 찾아보세요</strong><p>지도 이동과 검색어 입력은 잠시 멈춘 뒤 자동으로 반영됩니다.</p></div></div></aside>
      </section>
      <footer className="home-footer">© 2026 어디갈까 · 서울에서 발견하는 나만의 하루</footer>
      <BottomNav />
    </main>
  )
}
