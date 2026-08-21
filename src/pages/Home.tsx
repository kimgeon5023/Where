import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import WeatherWidget from '../components/WeatherWidget'
import type { Companion, Tag, TripRequest } from '../types'

const companions: { value: Companion; label: string; icon: IconName; caption: string }[] = [
  { value: 'friends', label: '친구', icon: 'friends', caption: '활기차게' },
  { value: 'couple', label: '연인', icon: 'heart', caption: '로맨틱하게' },
  { value: 'family', label: '가족', icon: 'family', caption: '편안하게' },
  { value: 'alone', label: '혼자', icon: 'person', caption: '내 페이스로' },
]
const likes: { value: Tag; label: string; icon: IconName }[] = [
  { value: 'cafe', label: '카페', icon: 'cafe' }, { value: 'foodie', label: '맛집', icon: 'food' },
  { value: 'photo', label: '사진', icon: 'photo' }, { value: 'nature', label: '자연', icon: 'nature' },
  { value: 'activity', label: '액티비티', icon: 'activity' }, { value: 'shopping', label: '쇼핑', icon: 'shopping' },
  { value: 'rest', label: '휴식', icon: 'rest' },
]
const dislikes: { value: Tag; label: string; icon: IconName }[] = [
  { value: 'crowded', label: '사람 많은 곳', icon: 'crowd' }, { value: 'noraebang', label: '노래방', icon: 'mic' },
  { value: 'pub', label: '술집', icon: 'pub' }, { value: 'sashimi', label: '회', icon: 'fish' },
]
const weatherOptions: { value: TripRequest['weather']; label: string; description: string; icon: IconName }[] = [
  { value: 'sunny', label: '맑은 날 코스', description: '야외 중심으로', icon: 'sun' },
  { value: 'cloudy', label: '선선한 날 코스', description: '야외와 실내 균형', icon: 'cloud' },
  { value: 'rain', label: '비 오는 날 코스', description: '실내 중심으로', icon: 'rain' },
]
const initialRequest: TripRequest = {
  start: '서울', dateStart: '2026-08-22', dateEnd: '2026-08-23', companion: 'friends', headcount: 3,
  budgetPerPerson: 50000, transport: 'public', likes: ['cafe', 'foodie', 'photo', 'activity'], dislikes: ['crowded'], weather: 'sunny',
}

function ToggleChip({ label, icon, active, danger, onClick }: { label: string; icon: IconName; active: boolean; danger?: boolean; onClick: () => void }) {
  const classes = 'tag-chip' + (active ? (danger ? ' tag-chip-danger active' : ' active') : '')
  return <button type="button" onClick={onClick} className={classes}><Icon name={icon} size={14} />{label}<small>{active ? 'ON' : 'OFF'}</small></button>
}

export default function Home() {
  const navigate = useNavigate()
  const [request, setRequest] = useState<TripRequest>(initialRequest)
  const [error, setError] = useState('')
  const update = <K extends keyof TripRequest>(key: K, value: TripRequest[K]) => setRequest((current) => ({ ...current, [key]: value }))
  const toggle = (key: 'likes' | 'dislikes', value: Tag) => setRequest((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((tag) => tag !== value) : [...current[key], value] }))
  const submit = () => {
    if (!request.dateStart || !request.dateEnd || request.dateEnd < request.dateStart) { setError('여행 날짜를 올바르게 선택해 주세요.'); return }
    setError(''); navigate('/result', { state: request })
  }
  return (
    <main className="app-shell home-shell">
      <header className="topbar"><div className="brand"><span className="brand-mark">W</span><span>어디갈까<span className="brand-dot">.</span></span></div><div className="topbar-note"><span className="live-dot" /> 서울 곳곳의 오늘</div></header>
      <section className="hero-copy"><div className="eyebrow">YOUR SEOUL, YOUR PLAN</div><h1>오늘은<br /><em>어디갈까?</em></h1><p>함께하는 사람, 예산, 취향만 알려주세요.<br />지금 딱 맞는 서울 하루를 만들어드릴게요.</p></section>
      <section className="form-card">
        <div className="form-card-head"><div><span className="step-label">STEP 01</span><h2>여행 조건을 알려주세요</h2></div><span className="form-card-count">1 / 2</span></div>
        <div className="form-section"><label className="field-label"><Icon name="pin" size={15} /> 어디서 출발하나요?</label><div className="input-wrap location-input"><Icon name="pin" size={16} /><input value={request.start} onChange={(event) => update('start', event.target.value)} placeholder="출발 지역을 입력하세요" /></div></div>
        <WeatherWidget onConditionChange={(condition) => update('weather', condition)} />
        <div className="form-section"><label className="field-label"><Icon name="calendar" size={15} /> 언제 떠날까요?</label><div className="date-row"><div className="input-wrap"><input type="date" value={request.dateStart} onChange={(event) => update('dateStart', event.target.value)} /></div><span className="date-separator">→</span><div className="input-wrap"><input type="date" value={request.dateEnd} onChange={(event) => update('dateEnd', event.target.value)} /></div></div></div>
        <div className="form-section"><label className="field-label"><Icon name="users" size={15} /> 누구와 함께하나요?</label><div className="companion-grid">{companions.map((item) => <button type="button" key={item.value} onClick={() => update('companion', item.value)} className={'companion-card' + (request.companion === item.value ? ' selected' : '')}><span className="companion-icon"><Icon name={item.icon} size={23} /></span><strong>{item.label}</strong><small>{item.caption}</small></button>)}</div></div>
        <div className="split-fields"><div className="form-section"><label className="field-label"><Icon name="users" size={15} /> 몇 명인가요?</label><div className="stepper"><button type="button" onClick={() => update('headcount', Math.max(1, request.headcount - 1))}><Icon name="minus" size={15} /></button><strong>{request.headcount}<small>명</small></strong><button type="button" onClick={() => update('headcount', request.headcount + 1)}><Icon name="plus" size={15} /></button></div></div><div className="form-section"><label className="field-label"><Icon name="card" size={15} /> 1인 예산</label><div className="input-wrap budget-input"><input type="number" min="0" step="10000" value={request.budgetPerPerson} onChange={(event) => update('budgetPerPerson', Number(event.target.value))} /><span>원</span></div></div></div>
        <div className="form-section"><label className="field-label"><Icon name="transit" size={15} /> 어떻게 이동할까요?</label><div className="segmented"><button type="button" className={request.transport === 'public' ? 'selected' : ''} onClick={() => update('transport', 'public')}><Icon name="transit" size={16} /> 대중교통</button><button type="button" className={request.transport === 'car' ? 'selected' : ''} onClick={() => update('transport', 'car')}><Icon name="car" size={16} /> 자차</button></div></div>
        <div className="form-section"><label className="field-label"><Icon name="cloud" size={15} /> 어떤 날씨에 어울리는 코스가 좋나요?</label><div className="weather-options">{weatherOptions.map((item) => <button type="button" key={item.value} className={'weather-option' + (request.weather === item.value ? ' selected' : '')} onClick={() => update('weather', item.value)}><Icon name={item.icon} size={20} /><strong>{item.label}</strong><small>{item.description}</small></button>)}</div></div>
        <div className="taste-panel"><div className="taste-heading"><div><span className="step-label">STEP 02</span><h2>취향을 골라주세요</h2></div><span>원하는 만큼 선택</span></div><div className="taste-group"><div className="taste-group-label like-label"><Icon name="heart" size={14} /> 좋아하는 것 <span>ON</span></div><div className="tag-list">{likes.map((item) => <ToggleChip key={item.value} {...item} active={request.likes.includes(item.value)} onClick={() => toggle('likes', item.value)} />)}</div></div><div className="taste-group"><div className="taste-group-label dislike-label"><Icon name="close" size={14} /> 피하고 싶은 것 <span>OFF</span></div><div className="tag-list">{dislikes.map((item) => <ToggleChip key={item.value} {...item} danger active={request.dislikes.includes(item.value)} onClick={() => toggle('dislikes', item.value)} />)}</div></div></div>
        {error && <p className="form-error">{error}</p>}<button type="button" className="primary-button search-button" onClick={submit}><span>내 여행 코스 찾기</span><Icon name="arrow" size={19} /></button><p className="privacy-note">입력한 취향은 추천 결과를 만드는 데만 사용돼요.</p>
      </section>
      <footer className="home-footer">© 2026 어디갈까 · 서울에서 발견하는 나만의 하루</footer>
    </main>
  )
}
