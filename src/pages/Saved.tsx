import { Link, useNavigate } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import Icon from '../components/Icon'
import PlaceCard from '../components/PlaceCard'
import BottomNav from '../components/BottomNav'
import { useFavorites } from '../favorites/FavoritesContext'

export default function Saved() {
  const { favorites, favoritesLoading, toggleFavorite } = useFavorites()
  const navigate = useNavigate()
  const applyAsCourse = () => {
    if (favorites.length === 0) return
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    navigate('/result', {
      state: {
        start: favorites[0]?.area || '은평구',
        dateStart: today,
        dateEnd: tomorrow,
        companion: 'friends',
        headcount: 2,
        budgetPerPerson: 50000,
        transport: 'public',
        likes: [],
        dislikes: [],
        weather: 'sunny',
        _fromSaved: true,
        _savedPlaces: favorites,
      },
    })
  }

  return (
    <main className="app-shell result-shell">
      <header className="topbar result-topbar">
        <Link to="/" className="brand"><span className="brand-mark">갈</span><span>갈래말래<span className="brand-dot">.</span></span></Link>
        <div className="result-top-actions"><span className="saved-count">♡ 저장한 코스 {favorites.length}</span><Link to="/" className="back-button">새 코스 찾기 <span>↗</span></Link><AuthActions /></div>
      </header>
      <section className="result-intro"><div><div className="eyebrow">SAVED PLACES</div><h1>내가 찜한<br /><em>장소</em>예요.</h1><p>마음에 든 장소를 모아 언제든 다시 확인하세요.</p></div></section>
       <section className="result-layout"><div className="itinerary-column"><div className="section-heading place-heading"><div><h2>저장한 장소</h2></div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span className="result-count">총 {favorites.length}곳</span>
              {favorites.length > 0 && <button type="button" className="primary-button" style={{ padding:'8px 14px', minHeight:34, fontSize:12, borderRadius:8 }} onClick={applyAsCourse}>자동 코스로 적용</button>}
            </div>
          </div>
          {favorites.length > 0 && <p style={{ margin:'0 0 12px', color:'#5a6d8a', fontSize:11 }}>담아둔 곳으로 바로 일정을 짜줘요 — 누르면 추천 결과에서 자동으로 코스가 만들어져요</p>}
          {favoritesLoading ? <div className="saved-empty"><p>찜한 장소를 불러오는 중이에요.</p></div> : favorites.length === 0 ? <div className="saved-empty"><Icon name="heart" size={28} /><p>아직 찜한 장소가 없어요.</p><Link to="/" className="back-button">장소 추천받기</Link></div> : <div className="place-list">{favorites.map((place, index) => <PlaceCard key={place.id} index={index + 1} scored={{ place, score: 0, fitScore: 0, detail: [], reasons: [] }} isSaved onToggleSaved={() => toggleFavorite(place)} />)}</div>}</div>      </section>
      <BottomNav />
    </main>
  )
}
