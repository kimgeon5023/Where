import type { ScoredPlace } from '../lib/scoring'
import Icon, { type IconName } from './Icon'

const labels: Record<string, string> = { tour: '명소', photo: '포토 스팟', cafe: '카페', food: '맛집', activity: '액티비티', lodging: '숙소' }
const icons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }

export default function PlaceCard({ index, scored, onRemove }: { index: number; scored: ScoredPlace; onRemove: (id: string) => void }) {
  const { place } = scored
  const cost = place.category === 'lodging' && place.lodging ? Math.round(place.lodging.pricePerNight / place.lodging.capacity) : place.price
  return (
    <article className="place-card">
      <div className="place-image" style={{ background: 'linear-gradient(135deg, ' + place.accent + ', #202638)' }}>
        <img src={place.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />
        <span className="place-number">{index}</span><span className="place-category"><Icon name={icons[place.category]} size={14} /> {labels[place.category]}</span>
        <button type="button" className="save-button" aria-label="저장"><Icon name="heart" size={16} /></button>
      </div>
      <div className="place-body">
        <div className="place-title-row"><div><div className="place-area">{place.area} · {labels[place.category]}</div><h3>{place.name}</h3></div><div className="score-badge"><strong>{scored.score}</strong><small>추천점수</small></div></div>
        <p className="place-description">{place.description}</p>
        <div className="place-meta"><span><Icon name="star" size={11} /> {place.rating}</span><span><Icon name="clock" size={11} /> {place.durationMin}분</span><span>₩ {cost.toLocaleString()}~</span><span>{place.indoor ? '실내' : '야외'}</span></div>
        <div className="reason-row">{scored.reasons.slice(0, 2).map((reason) => <span key={reason}>✓ {reason}</span>)}</div>
        {place.lodging && <div className="detail-box lodging-detail"><strong>1박 {place.lodging.pricePerNight.toLocaleString()}원</strong><span>{place.lodging.capacity}인 · {place.lodging.parking ? '주차 가능' : '주차 불가'} · {place.lodging.bed}</span></div>}
        {place.menu && <div className="detail-box menu-detail"><strong>대표 메뉴</strong><span>{place.menu.slice(0, 3).map((menu) => menu.name + ' ' + menu.price.toLocaleString() + '원').join('  ·  ')}</span></div>}
        <div className="place-actions"><button type="button" onClick={() => onRemove(place.id)} className="ghost-button"><Icon name="close" size={13} /> 이 장소는 빼기</button><a href={'https://map.kakao.com/?q=' + encodeURIComponent(place.name)} target="_blank" rel="noreferrer" className="ghost-button">지도에서 보기 <Icon name="arrow" size={13} /></a></div>
      </div>
    </article>
  )
}
