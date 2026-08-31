import { useState } from 'react'
import type { ScoredPlace } from '../lib/scoring'
import Icon, { type IconName } from './Icon'

const labels: Record<string, string> = { tour: '명소', photo: '포토 스팟', cafe: '카페', food: '맛집', activity: '액티비티', lodging: '숙소' }
const icons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }

interface Review { text: string; rating: number; time: string }
const reviewsKey = (id: string) => `where-to-go-reviews:${id}`

function getReviews(placeId: string): Review[] {
  try {
    const stored = localStorage.getItem(reviewsKey(placeId))
    return stored ? JSON.parse(stored) as Review[] : []
  } catch { return [] }
}

function saveReview(placeId: string, review: Review) {
  const existing = getReviews(placeId)
  localStorage.setItem(reviewsKey(placeId), JSON.stringify([...existing, review]))
}

export default function PlaceCard({ index, scored, onRemove, isSaved = false, onToggleSaved, onSelect }: { index: number; scored: ScoredPlace; onRemove?: (id: string) => void; isSaved?: boolean; onToggleSaved?: () => void; onSelect?: (id: string) => void }) {
  const { place } = scored
  const cost = place.category === 'lodging' && place.lodging ? Math.round(place.lodging.pricePerNight / place.lodging.capacity) : place.price
  const [reviews, setReviews] = useState(() => getReviews(place.id))
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [showReviewForm, setShowReviewForm] = useState(false)

  const submitReview = () => {
    if (!reviewText.trim()) return
    const review: Review = { text: reviewText.trim(), rating: reviewRating, time: new Date().toLocaleDateString('ko-KR') }
    saveReview(place.id, review)
    setReviews((prev) => [...prev, review])
    setReviewText('')
    setReviewRating(5)
    setShowReviewForm(false)
  }

  return (
    <article className="place-card" onClick={() => onSelect?.(place.id)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
      <div className="place-image" style={{ background: 'linear-gradient(135deg, ' + place.accent + ', #202638)' }}>
        <img src={place.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
        <span className="place-number">{index}</span><span className="place-category"><Icon name={icons[place.category]} size={14} /> {labels[place.category]}</span>
        <button type="button" className={'save-button' + (isSaved ? ' saved' : '')} aria-label={isSaved ? '찜 해제' : '찜하기'} aria-pressed={isSaved} onClick={onToggleSaved}><Icon name="heart" size={16} /></button>
      </div>
      <div className="place-body">
        <div className="place-title-row"><div><div className="place-area">{place.area} · {labels[place.category]}</div><h3>{place.name}</h3></div><div className="score-badge"><strong>{scored.score}</strong><small>추천점수</small></div></div>
        <p className="place-description">{place.description}</p>
        <div className="place-meta"><span><Icon name="star" size={11} /> {place.rating}</span><span><Icon name="clock" size={11} /> {place.durationMin}분</span><span>₩ {cost.toLocaleString()}~</span><span>{place.indoor ? '실내' : '야외'}</span></div>
        <div className="reason-row">{scored.reasons.slice(0, 2).map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
        {place.lodging && <div className="detail-box lodging-detail"><strong>1박 {place.lodging.pricePerNight.toLocaleString()}원</strong><span>{place.lodging.capacity}인 · {place.lodging.parking ? '주차 가능' : '주차 불가'} · {place.lodging.bed}</span></div>}
        {place.menu && <div className="detail-box menu-detail"><strong>대표 메뉴</strong><span>{place.menu.slice(0, 3).map((menu) => menu.name + ' ' + menu.price.toLocaleString() + '원').join('  ·  ')}</span></div>}
        {reviews.length > 0 && (
          <div style={{ marginTop: 13, padding: '10px 11px', borderRadius: 8, background: '#f4f8f5', border: '1px solid #e8ece7' }}>
            <strong style={{ fontSize: 11, color: '#4c6658' }}>방문자 후기 ({reviews.length}개)</strong>
            {reviews.slice(-2).map((r, i) => (
              <div key={i} style={{ marginTop: 8, padding: '6px 0', borderTop: i > 0 ? '1px solid #e8ece7' : 'none' }}>
                <span style={{ color: '#f4b448', fontSize: 11 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                <p style={{ margin: '3px 0 0', color: '#646b65', fontSize: 11, lineHeight: 1.5 }}>{r.text}</p>
                <span style={{ color: '#aab5ac', fontSize: 9 }}>{r.time}</span>
              </div>
            ))}
          </div>
        )}
        {showReviewForm ? (
          <div style={{ marginTop: 13, padding: 12, borderRadius: 10, border: '1px solid #dceee5', background: '#f4fbf7' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setReviewRating(star)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, color: star <= reviewRating ? '#f4b448' : '#d6ddd7' }}>★</button>
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="방문 후기를 남겨주세요..." rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid #dceee5', borderRadius: 8, resize: 'vertical', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button type="button" className="ghost-button" onClick={() => setShowReviewForm(false)} style={{ flex: 1 }}>취소</button>
              <button type="button" className="primary-button" onClick={submitReview} style={{ flex: 1, minHeight: 36, fontSize: 11 }}>후기 등록</button>
            </div>
          </div>
        ) : (
          <button type="button" className="ghost-button" style={{ marginTop: 13 }} onClick={() => setShowReviewForm(true)}>
            <Icon name="camera" size={13} /> 후기 남기기
          </button>
        )}
        <div className="place-actions">{onRemove && <button type="button" onClick={() => onRemove(place.id)} className="ghost-button"><Icon name="close" size={13} /> 이 장소는 빼기</button>}<a href={place.placeUrl || ('https://map.kakao.com/?q=' + encodeURIComponent(place.name))} target="_blank" rel="noreferrer" className="ghost-button">지도에서 보기 <Icon name="arrow" size={13} /></a></div>
      </div>
    </article>
  )
}
