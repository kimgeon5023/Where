import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import { getSavedPlaces } from '../lib/savedPlaces'
import { searchSeoulAreas, type SeoulArea } from '../lib/areasApi'
import type { Companion, TripRequest } from '../types'

const companions: { value: Companion; label: string; icon: IconName; caption: string }[] = [
  { value: 'friends', label: '친구와', icon: 'friends', caption: '함께 만드는 하루' },
  { value: 'couple', label: '연인과', icon: 'heart', caption: '설레는 데이트' },
  { value: 'family', label: '가족과', icon: 'family', caption: '편안한 나들이' },
  { value: 'alone', label: '혼자', icon: 'person', caption: '나만의 시간' },
]

function localDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function nextLocalDate(today: string) {
  const [year, month, day] = today.split('-').map(Number)
  const next = new Date(year, month - 1, day)
  next.setDate(next.getDate() + 1)
  return localDateValue(next)
}

function createInitialRequest(today: string): TripRequest {
  return { start: '', dateStart: today, dateEnd: nextLocalDate(today), companion: 'friends', headcount: 2, budgetPerPerson: 50000, transport: 'public', likes: [], dislikes: ['crowded'], weather: 'sunny' }
}

export default function Home() {
  const navigate = useNavigate()
  const [today] = useState(() => localDateValue())
  const [request, setRequest] = useState<TripRequest>(() => createInitialRequest(today))
  const [error, setError] = useState('')
  const [areaPickerOpen, setAreaPickerOpen] = useState(false)
  const [areaSuggestions, setAreaSuggestions] = useState<SeoulArea[]>([])
  const [areaSearching, setAreaSearching] = useState(false)
  const [selectedArea, setSelectedArea] = useState(false)
  const [savedCount] = useState(() => getSavedPlaces().length)
  const update = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => setRequest((current) => ({ ...current, [key]: value }))
  const updateStartDate = (dateStart: string) => setRequest((current) => ({ ...current, dateStart, dateEnd: current.dateEnd < dateStart ? dateStart : current.dateEnd }))
  const areaQuery = request.start.trim()

  useEffect(() => {
    if (!areaPickerOpen || !areaQuery) { setAreaSuggestions([]); setAreaSearching(false); return undefined }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setAreaSearching(true)
      searchSeoulAreas(areaQuery, controller.signal).then(setAreaSuggestions).catch((searchError: unknown) => {
        if (!(searchError instanceof DOMException && searchError.name === 'AbortError')) setAreaSuggestions([])
      }).finally(() => setAreaSearching(false))
    }, 280)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [areaPickerOpen, areaQuery])

  const submit = () => {
    if (!request.start.trim() || !selectedArea) { setError('서울 지역 추천 목록에서 지역을 선택해 주세요.'); return }
    if (!request.dateStart || !request.dateEnd || request.dateEnd < request.dateStart) { setError('여행 날짜를 올바르게 선택해 주세요.'); return }
    setError('')
    navigate('/result', { state: request })
  }

  return <main className="app-shell booking-shell">
    <header className="booking-header">
      <Link to="/" className="booking-brand" aria-label="갈래말래 홈"><span className="booking-brand-mark">갈</span><span>갈래말래</span></Link>
      <nav className="booking-nav" aria-label="주요 메뉴"><a href="#planner">맞춤 코스</a><Link to="/saved">찜한 장소</Link><Link to="/friends">친구와 여행</Link></nav>
      <div className="booking-header-actions"><Link to="/saved" className="booking-saved-link"><Icon name="heart" size={15} /> 찜 {savedCount}</Link><AuthActions /></div>
    </header>
    <section className="booking-hero" aria-labelledby="hero-title">
      <div className="booking-orbit booking-orbit-one" /><div className="booking-orbit booking-orbit-two" />
      <div className="booking-hero-copy"><p className="booking-kicker"><span /> SEOUL TRIP PLANNER</p><h1 id="hero-title">이번 주말,<br /><strong>어디로 갈까요?</strong></h1><p>지역과 일정, 동행만 고르면<br />결과 화면에서 원하는 테마의 서울 장소를 자유롭게 둘러볼 수 있어요.</p><div className="booking-hero-points"><span><Icon name="check" size={15} /> 서울 지역 검색</span><span><Icon name="check" size={15} /> 결과에서 세부 필터</span></div></div>
      <div className="booking-hero-ticket" aria-hidden="true"><div className="ticket-top"><span>WEEKEND PASS</span><Icon name="route" size={19} /></div><strong>SEOUL<br />ESCAPE</strong><div className="ticket-route"><span>NOW</span><i /><span>GO</span></div></div>
    </section>
    <section id="planner" className="booking-planner" aria-label="여행 코스 조건">
      <div className="planner-tabs"><button type="button" className="active"><Icon name="spark" size={16} /> 맞춤 코스 만들기</button><span>서울에서 즐기는 나만의 하루</span></div>
      <div className="planner-main-fields">
        <label className="planner-field planner-destination"><span><Icon name="pin" size={18} /> 어디로 갈까요?</span><div className="planner-area-picker"><input value={request.start} onFocus={() => setAreaPickerOpen(Boolean(areaQuery))} onBlur={() => window.setTimeout(() => setAreaPickerOpen(false), 120)} onChange={(event) => { update('start', event.target.value); setSelectedArea(false); setAreaPickerOpen(Boolean(event.target.value.trim())) }} onKeyDown={(event) => { if (event.key === 'Escape') setAreaPickerOpen(false) }} placeholder="서울의 구, 동 또는 주요 지역" autoComplete="off" aria-autocomplete="list" aria-controls="seoul-area-suggestions" aria-expanded={areaPickerOpen && Boolean(areaQuery)} />{areaPickerOpen && areaQuery && <div id="seoul-area-suggestions" className="planner-area-suggestions" role="listbox" aria-label="서울 지역 추천">{areaSearching ? <p>검색 중...</p> : areaSuggestions.length > 0 ? areaSuggestions.map((area) => <button type="button" key={area.id} role="option" aria-selected={request.start === area.name} onMouseDown={(event) => event.preventDefault()} onClick={() => { update('start', area.name); setSelectedArea(true); setAreaPickerOpen(false) }}>{area.name}</button>) : <p>서울 지역 검색 결과가 없습니다.</p>}</div>}</div></label>
        <label className="planner-field"><span><Icon name="calendar" size={18} /> 출발일</span><input type="date" min={today} value={request.dateStart} onChange={(event) => updateStartDate(event.target.value)} /></label>
        <label className="planner-field"><span><Icon name="calendar" size={18} /> 도착일</span><input type="date" min={request.dateStart || today} value={request.dateEnd} onChange={(event) => update('dateEnd', event.target.value)} /></label>
        <button type="button" className="planner-search" onClick={submit}>코스 찾기 <Icon name="arrow" size={18} /></button>
      </div>
      <div className="planner-preferences"><div className="planner-preference-row"><span className="preference-label">누구와 가나요?</span><div className="booking-companions">{companions.map((item) => <button type="button" key={item.value} className={request.companion === item.value ? 'active' : ''} onClick={() => update('companion', item.value)}><Icon name={item.icon} size={17} /><span><strong>{item.label}</strong><small>{item.caption}</small></span></button>)}</div></div>{error && <p className="booking-form-error">{error}</p>}</div>
    </section>
    <footer className="booking-footer"><span className="booking-brand-mark">갈</span><p>나에게 꼭 맞는 서울의 하루를 찾아보세요.</p><span>© 2026 갈래말래</span></footer>
    <BottomNav />
  </main>
}
