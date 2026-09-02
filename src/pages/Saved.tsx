import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import Icon from '../components/Icon'
import PlaceCard from '../components/PlaceCard'
import BottomNav from '../components/BottomNav'
import { useFavorites } from '../favorites/FavoritesContext'

export default function Saved() {
  const { favorites, favoritesLoading, legacyFavoritesCount, toggleFavorite, importLegacyFavorites } = useFavorites()
  const [legacyImporting, setLegacyImporting] = useState(false)
  const [legacyMessage, setLegacyMessage] = useState('')

  const importLegacy = async () => {
    setLegacyImporting(true)
    try {
      await importLegacyFavorites()
      setLegacyMessage('기존 찜 목록을 현재 계정에 저장했어요.')
    } catch {
      setLegacyMessage('기존 찜 목록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLegacyImporting(false)
    }
  }

  return (
    <main className="app-shell result-shell">
      <header className="topbar result-topbar">
        <Link to="/" className="brand"><span className="brand-mark">갈</span><span>갈래말래<span className="brand-dot">.</span></span></Link>
        <div className="result-top-actions"><span className="saved-count">♡ 찜한 장소 {favorites.length}</span><Link to="/trips" className="saved-count">저장한 코스</Link><Link to="/" className="back-button">새 코스 찾기 <span>↗</span></Link><AuthActions /></div>
      </header>
      <section className="result-intro"><div><div className="eyebrow">SAVED PLACES</div><h1>내가 찜한<br /><em>장소</em>예요.</h1><p>마음에 든 장소를 모아 언제든 다시 확인하세요.</p></div></section>
      <section className="result-layout"><div className="itinerary-column"><div className="section-heading place-heading"><div><h2>저장한 장소</h2></div><span className="result-count">총 {favorites.length}곳</span></div>{legacyFavoritesCount > 0 && <div className="saved-empty" style={{ marginBottom: 18 }}><p>이 브라우저에 기존 찜 {legacyFavoritesCount}곳이 남아 있어요.</p><button type="button" className="primary-button" onClick={importLegacy} disabled={legacyImporting}>{legacyImporting ? '기존 찜을 저장하는 중...' : '현재 계정으로 기존 찜 가져오기'}</button><small style={{ display: 'block', marginTop: 8 }}>가져오기 전, 현재 로그인한 계정이 맞는지 확인해 주세요.</small>{legacyMessage && <p>{legacyMessage}</p>}</div>}{favoritesLoading ? <div className="saved-empty"><p>찜한 장소를 불러오는 중이에요.</p></div> : favorites.length === 0 ? <div className="saved-empty"><Icon name="heart" size={28} /><p>아직 찜한 장소가 없어요.</p><Link to="/" className="back-button">장소 추천받기</Link></div> : <div className="place-list">{favorites.map((place, index) => <PlaceCard key={place.id} index={index + 1} scored={{ place, score: 0, fitScore: 0, detail: [], reasons: [] }} isSaved onToggleSaved={() => toggleFavorite(place)} />)}</div>}</div>      </section>
      <BottomNav />
    </main>
  )
}
