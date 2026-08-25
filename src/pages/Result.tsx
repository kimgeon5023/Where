import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Home from './Home'
import { places } from '../data/places'
import { searchPlaces } from '../lib/placesApi'
import { buildItineraries, estimateBudget, recommend } from '../lib/scoring'
import { getSavedPlaces, toggleSavedPlace } from '../lib/savedPlaces'
import type { Category, Place, TripRequest } from '../types'
import Icon, { type IconName } from '../components/Icon'
import MapView from '../components/MapView'
import PlaceCard from '../components/PlaceCard'
import AuthActions from '../components/AuthActions'
import WeatherWidget from '../components/WeatherWidget'

const companionLabels = { friends: '친구', couple: '연인', family: '가족', alone: '혼자' }
const weatherLabels: Record<TripRequest['weather'], { icon: IconName; label: string; temp: string; rain: string }> = { sunny: { icon: 'sun', label: '맑음', temp: '27°', rain: '강수확률 10%' }, cloudy: { icon: 'cloud', label: '구름 조금', temp: '25°', rain: '강수확률 20%' }, rain: { icon: 'rain', label: '비', temp: '22°', rain: '강수확률 70%' } }
const categoryIcons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }
const searchCategories: { value?: Category; label: string }[] = [
  { label: '전체' }, { value: 'food', label: '맛집' }, { value: 'cafe', label: '카페' },
  { value: 'tour', label: '관광지' }, { value: 'lodging', label: '숙소' }, { value: 'activity', label: '액티비티' },
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

function matchesSelectedArea(place: Place, area: string) {
  const target = area.trim().toLowerCase()
  if (!target || target === '서울' || target === '서울 전체') return true
  const placeWithDistrict = place as Place & { district?: string }
  return [place.area, placeWithDistrict.district].filter(Boolean).some((value) => value!.toLowerCase().includes(target))
}

export default function Result() {
  const location = useLocation()
  const req = location.state as TripRequest | null
  const [excluded, setExcluded] = useState<string[]>([])
  const [day, setDay] = useState(0)
  const [category, setCategory] = useState<Category | undefined>()
  const [apiPlaces, setApiPlaces] = useState(places)
  const [apiError, setApiError] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [savedPlaces, setSavedPlaces] = useState(getSavedPlaces)

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition((position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }), undefined, { enableHighAccuracy: true, maximumAge: 30000 })
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  useEffect(() => {
    if (!req) return
    const controller = new AbortController()
    setApiError('')
    searchPlaces({ area: req.start, category, companion: req.companion, limit: 100, ...userLocation }, controller.signal)
      .then(({ data }) => {
        const areaPlaces = data.filter((place) => matchesSelectedArea(place, req.start))
        setApiPlaces(areaPlaces)
        if (areaPlaces.length === 0 && req.start !== '서울') setApiError(`${req.start}에 등록된 추천 장소가 아직 없어요.`)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setApiError(`${req.start} 장소 API에 연결하지 못해 해당 지역의 기본 장소를 표시합니다.`)
        setApiPlaces(places.filter((place) => matchesSelectedArea(place, req.start)))
      })
    return () => controller.abort()
  }, [req, category, userLocation])

  const dayCount = req ? daysBetween(req.dateStart, req.dateEnd) : 1
  const scored = useMemo(() => req ? recommend(apiPlaces, req, excluded) : [], [req, apiPlaces, excluded])
  const itineraries = useMemo(() => buildItineraries(scored, dayCount), [scored, dayCount])
  const currentCourse = itineraries[day] ?? []
  const allCourse = useMemo(() => {
    const seen = new Set<string>()
    return itineraries.flat().filter((stop) => {
      if (seen.has(stop.place.id)) return false
      seen.add(stop.place.id)
      return true
    }).map((stop) => scored.find((item) => item.place.id === stop.place.id)).filter(Boolean) as typeof scored
  }, [itineraries, scored])
  const budget = useMemo(() => req ? estimateBudget(req, allCourse) : { items: [], total: 0, perPerson: 0 }, [req, allCourse])
  const coursePlaces = currentCourse.map((stop) => stop.place)
  const recommended = scored.slice(0, 8)
  const recommendedPlaces = recommended.map((item) => item.place)
  const mapPlaces = recommendedPlaces.length > 0 ? recommendedPlaces : coursePlaces
  const center: [number, number] = mapPlaces[0] ? [mapPlaces[0].lat, mapPlaces[0].lng] : [37.5668, 126.978]
  const weather = req ? weatherLabels[req.weather] : weatherLabels.sunny

  if (!req) {
    return <Home />
  }

  return (
    <main className="app-shell result-shell">
      <header className="topbar result-topbar">
        <Link to="/" className="brand"><span className="brand-mark">W</span><span>어디갈까<span className="brand-dot">.</span></span></Link>
        <div className="result-top-actions"><Link to="/saved" className="saved-count">♡ 저장한 코스 {savedPlaces.length}</Link><Link to="/" className="back-button">조건 다시 설정 <span>↗</span></Link><AuthActions /></div>
      </header>
      <section className="result-intro">
        <div><div className="eyebrow">YOUR SEOUL, YOUR PLAN</div><h1><em>{req.start}</em>에서<br />이렇게 놀아보세요.</h1><p>{companionLabels[req.companion]} {req.headcount}명 · {dateLabel(req.dateStart)} — {dateLabel(req.dateEnd)} · 1인 {req.budgetPerPerson.toLocaleString()}원</p></div>
        <div className="result-weather-live"><WeatherWidget compact /><div className="weather-summary"><div className="weather-icon"><Icon name={weather.icon} size={27} /></div><div><strong>{weather.temp}</strong><span>{weather.label} · {weather.rain}</span></div></div></div>
      </section>
      <section className="result-layout">
        <div className="itinerary-column">
          <div className="section-heading"><div><span className="step-label">RECOMMENDED ROUTE</span><h2>당신을 위한 맞춤 코스</h2></div><span className="result-count">{scored.length}개의 장소를 찾았어요</span></div>
          {apiError && <p className="form-error">{apiError}</p>}
          <div className="tag-list" aria-label="장소 카테고리 검색">
            {searchCategories.map((item) => <button type="button" key={item.label} className={'tag-chip' + (category === item.value ? ' active' : '')} onClick={() => { setCategory(item.value); setDay(0) }}>{item.label}</button>)}
          </div>
          <div className="day-tabs">{Array.from({ length: dayCount }).map((_, index) => <button type="button" key={index} onClick={() => setDay(index)} className={day === index ? 'selected' : ''}><span>DAY {index + 1}</span><small>{index === 0 ? dateLabel(req.dateStart) : '다음 날'}</small></button>)}</div>
          <div className="route-card">
            <div className="route-card-top"><div><span className="route-kicker">DAY {day + 1} · {dateLabel(day === 0 ? req.dateStart : req.dateEnd)}</span><h3>오늘은 {req.start === '서울' ? '서울 곳곳' : req.start}에서 놀아보세요</h3></div><span className="route-weather"><Icon name={weather.icon} size={13} /> {weather.temp}</span></div>
            <div className="timeline">{currentCourse.length === 0 && <p className="empty-route">조건에 맞는 장소가 없어요. 취향을 조금만 바꿔볼까요?</p>}{currentCourse.map((stop, index) => <div className="timeline-item" key={stop.place.id}><div className="timeline-time">{stop.time}</div><div className="timeline-line"><span className="timeline-dot"><Icon name={categoryIcons[stop.place.category]} size={14} /></span>{index < currentCourse.length - 1 && <i />}</div><div className="timeline-content"><strong>{stop.place.name}</strong><span>{stop.place.area} · {stop.place.description}</span>{index < currentCourse.length - 1 && <small>다음 장소까지 약 {index % 2 === 0 ? 12 : 8}분</small>}</div></div>)}</div>
          </div>
          <div className="section-heading place-heading"><div><h2>지도 주변 맞춤 추천</h2></div><span className="result-count">상위 {recommended.length}곳을 추천해요</span></div>
          <div className="ai-insight"><Icon name="spark" size={20} /><div><strong>취향과 지도를 함께 분석했어요</strong><p>{req.start} 주변의 맛집·카페·숙소를 이동 거리와 평점까지 고려해 골랐어요.</p></div></div>
          <div className="place-list">{recommended.map((item, index) => <PlaceCard key={item.place.id} index={index + 1} scored={item} onRemove={(id) => setExcluded((current) => [...current, id])} isSaved={savedPlaces.some((place) => place.id === item.place.id)} onToggleSaved={() => setSavedPlaces((current) => toggleSavedPlace(current, item.place))} />)}</div>
          <div className="budget-card"><div className="budget-header"><div><span className="step-label">ESTIMATED COST</span><h2>예상 여행 비용</h2></div><span className="budget-person">1인 기준</span></div><div className="budget-content"><div className="budget-total"><strong>{budget.perPerson.toLocaleString()}<small>원</small></strong><span>예산의 {Math.min(999, Math.round((budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100))}% 사용</span><div className="budget-progress"><i style={{ width: Math.min(100, (budget.perPerson / Math.max(1, req.budgetPerPerson)) * 100) + '%' }} /></div></div><div className="budget-breakdown">{budget.items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.cost.toLocaleString()}원</strong></div>)}</div></div></div>
        </div>
        <aside className="map-column"><div className="map-card"><MapView places={mapPlaces} routePlaces={coursePlaces} center={center} /><div className="map-legend"><span><i className="legend-dot green" /> 추천 장소</span><span><i className="legend-line" /> 예상 이동 경로</span></div></div><div className="side-tip"><Icon name="spark" size={20} /><div><strong>AI가 지도에서 골랐어요</strong><p>취향·평점·예산·날씨와 현재 코스 주변 거리를 함께 반영했어요.</p></div></div></aside>
      </section>
      <footer className="home-footer">© 2026 어디갈까 · 서울에서 발견하는 나만의 하루</footer>
    </main>
  )
}
