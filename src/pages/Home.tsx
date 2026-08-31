import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import { getSavedPlaces } from '../lib/savedPlaces'
import type { Companion, Tag, TripRequest } from '../types'

const companions: { value: Companion; label: string; icon: IconName; caption: string }[] = [
  { value: 'friends', label: '친구와', icon: 'friends', caption: '신나는 하루' },
  { value: 'couple', label: '연인과', icon: 'heart', caption: '설레는 데이트' },
  { value: 'family', label: '가족과', icon: 'family', caption: '편안한 나들이' },
  { value: 'alone', label: '혼자', icon: 'person', caption: '나만의 시간' },
]
const likes: { value: Tag; label: string; icon: IconName }[] = [
  { value: 'cafe', label: '카페', icon: 'cafe' }, { value: 'foodie', label: '맛집', icon: 'food' },
  { value: 'photo', label: '사진', icon: 'photo' }, { value: 'nature', label: '자연', icon: 'nature' },
  { value: 'activity', label: '액티비티', icon: 'activity' }, { value: 'shopping', label: '쇼핑', icon: 'shopping' }, { value: 'rest', label: '휴식', icon: 'rest' },
]
const initialRequest: TripRequest = {
  start: '서울', dateStart: '2026-08-29', dateEnd: '2026-08-30', companion: 'friends', headcount: 3,
  budgetPerPerson: 50000, transport: 'public', likes: ['cafe', 'foodie', 'photo'], dislikes: ['crowded'], weather: 'sunny',
}

export default function Home() {
  const navigate = useNavigate()
  const [request, setRequest] = useState<TripRequest>(initialRequest)
  const [error, setError] = useState('')
  const [savedCount] = useState(() => getSavedPlaces().length)
  const update = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => setRequest((current) => ({ ...current, [key]: value }))
  const toggleLike = (value: Tag) => setRequest((current) => ({ ...current, likes: current.likes.includes(value) ? current.likes.filter((tag) => tag !== value) : [...current.likes, value] }))

  useEffect(() => {
    if (request.companion === 'couple' && request.headcount !== 2) update('headcount', 2)
    if (request.companion === 'alone' && request.headcount !== 1) update('headcount', 1)
  }, [request.companion, request.headcount])

  const submit = () => {
    if (!request.start.trim()) { setError('출발 지역을 입력해 주세요.'); return }
    if (!request.dateStart || !request.dateEnd || request.dateEnd < request.dateStart) { setError('여행 날짜를 올바르게 선택해 주세요.'); return }
    setError(''); navigate('/result', { state: request })
  }

  return <main className="app-shell booking-shell">
    <header className="booking-header">
      <Link to="/" className="booking-brand" aria-label="어디갈까 홈"><span className="booking-brand-mark">W</span><span>어디갈까</span></Link>
      <nav className="booking-nav" aria-label="주요 메뉴"><a href="#planner">맞춤 코스</a><a href="#popular">인기 테마</a><Link to="/saved">찜한 장소</Link><Link to="/friends">친구와 여행</Link></nav>
      <div className="booking-header-actions"><Link to="/saved" className="booking-saved-link"><Icon name="heart" size={15} /> 찜 {savedCount}</Link><AuthActions /></div>
    </header>

    <section className="booking-hero" aria-labelledby="hero-title">
      <div className="booking-orbit booking-orbit-one" /><div className="booking-orbit booking-orbit-two" />
      <div className="booking-hero-copy"><p className="booking-kicker"><span /> SEOUL TRIP PLANNER</p><h1 id="hero-title">이번 주말,<br /><strong>어디로 떠날까요?</strong></h1><p>취향부터 이동수단까지 한 번에 고르면<br />나에게 맞는 서울 여행 코스를 추천해 드려요.</p><div className="booking-hero-points"><span><Icon name="check" size={15} /> 실시간 장소 검색</span><span><Icon name="check" size={15} /> 날씨 맞춤 추천</span></div></div>
      <div className="booking-hero-ticket" aria-hidden="true"><div className="ticket-top"><span>WEEKEND PASS</span><Icon name="route" size={19} /></div><strong>SEOUL<br />ESCAPE</strong><div className="ticket-route"><span>NOW</span><i /><span>GO</span></div></div>
    </section>

    <section id="planner" className="booking-planner" aria-label="여행 코스 조건">
      <div className="planner-tabs"><button type="button" className="active"><Icon name="spark" size={16} /> 맞춤 코스 만들기</button><span>서울에서 즐기는 나만의 하루</span></div>
      <div className="planner-main-fields">
        <label className="planner-field planner-destination"><span><Icon name="pin" size={18} /> 어디로 갈까요?</span><input value={request.start} onChange={(event) => update('start', event.target.value)} placeholder="서울 또는 구 이름" /></label>
        <label className="planner-field"><span><Icon name="calendar" size={18} /> 출발일</span><input type="date" value={request.dateStart} onChange={(event) => update('dateStart', event.target.value)} /></label>
        <label className="planner-field"><span><Icon name="calendar" size={18} /> 도착일</span><input type="date" value={request.dateEnd} onChange={(event) => update('dateEnd', event.target.value)} /></label>
        <div className="planner-field planner-guests"><span><Icon name="users" size={18} /> 인원</span><div className="compact-stepper"><button type="button" aria-label="인원 줄이기" onClick={() => update('headcount', Math.max(1, request.headcount - 1))}><Icon name="minus" size={14} /></button><strong>{request.headcount}명</strong><button type="button" aria-label="인원 늘리기" onClick={() => update('headcount', request.headcount + 1)}><Icon name="plus" size={14} /></button></div></div>
        <button type="button" className="planner-search" onClick={submit}>코스 찾기 <Icon name="arrow" size={18} /></button>
      </div>
      <div className="planner-preferences">
        <div className="planner-preference-row"><span className="preference-label">누구와 가나요?</span><div className="booking-companions">{companions.map((item) => <button type="button" key={item.value} className={request.companion === item.value ? 'active' : ''} onClick={() => update('companion', item.value)}><Icon name={item.icon} size={17} /><span><strong>{item.label}</strong><small>{item.caption}</small></span></button>)}</div></div>
        <div className="planner-preference-row"><span className="preference-label">무엇을 좋아하나요?</span><div className="booking-tastes">{likes.map((item) => <button type="button" key={item.value} className={request.likes.includes(item.value) ? 'active' : ''} onClick={() => toggleLike(item.value)}><Icon name={item.icon} size={15} />{item.label}</button>)}</div></div>
        <details className="planner-more"><summary>상세 조건 설정 <Icon name="arrow" size={14} /></summary><div className="planner-more-grid"><label>1인 예산 <span className="planner-input"><input type="number" min="0" step="10000" value={request.budgetPerPerson} onChange={(event) => update('budgetPerPerson', Number(event.target.value))} />원</span></label><div><span>이동수단</span><div className="booking-choice"><button type="button" className={request.transport === 'public' ? 'active' : ''} onClick={() => update('transport', 'public')}><Icon name="transit" size={15} />대중교통</button><button type="button" className={request.transport === 'car' ? 'active' : ''} onClick={() => update('transport', 'car')}><Icon name="car" size={15} />자가용</button></div></div><div><span>날씨</span><div className="booking-choice"><button type="button" className={request.weather === 'sunny' ? 'active' : ''} onClick={() => update('weather', 'sunny')}><Icon name="sun" size={15} />맑음</button><button type="button" className={request.weather === 'cloudy' ? 'active' : ''} onClick={() => update('weather', 'cloudy')}><Icon name="cloud" size={15} />흐림</button><button type="button" className={request.weather === 'rain' ? 'active' : ''} onClick={() => update('weather', 'rain')}><Icon name="rain" size={15} />비</button></div></div></div></details>
        {error && <p className="booking-form-error">{error}</p>}
      </div>
    </section>

    <section id="popular" className="booking-popular" aria-labelledby="popular-title"><div><p className="booking-section-kicker">CURATED FOR YOU</p><h2 id="popular-title">어떤 하루를<br /><em>꿈꾸고 있나요?</em></h2></div><div className="theme-card-grid"><button type="button" className="theme-card theme-cafe" onClick={() => { update('likes', ['cafe', 'photo']); update('companion', 'friends') }}><Icon name="cafe" size={25} /><span>여유로운 오후</span><strong>카페 투어</strong><small>감성 카페와 산책</small></button><button type="button" className="theme-card theme-food" onClick={() => { update('likes', ['foodie', 'shopping']); update('companion', 'friends') }}><Icon name="food" size={25} /><span>서울의 맛</span><strong>미식 탐험</strong><small>맛집부터 시장까지</small></button><button type="button" className="theme-card theme-nature" onClick={() => { update('likes', ['nature', 'photo', 'rest']); update('companion', 'alone') }}><Icon name="nature" size={25} /><span>도심 속 쉼</span><strong>초록 산책</strong><small>공원과 전망 명소</small></button></div></section>
    <footer className="booking-footer"><span className="booking-brand-mark">W</span><p>나에게 꼭 맞는 서울의 하루를 찾아보세요.</p><span>© 2026 WHERE</span></footer>
    <BottomNav />
  </main>
}
