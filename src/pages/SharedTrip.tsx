import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSharedTrip, type Trip } from '../lib/tripsApi'
import Icon from '../components/Icon'

export default function SharedTrip() {
  const { shareToken = '' } = useParams()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getSharedTrip(shareToken).then(setTrip).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '공개 코스를 불러오지 못했습니다.'))
  }, [shareToken])

  if (error) return <main className="app-shell"><section className="empty-state"><h1>공개 코스를 찾을 수 없습니다.</h1><p>{error}</p><Link to="/" className="primary-button">메인으로 이동</Link></section></main>
  if (!trip) return <main className="app-shell"><section className="empty-state"><p>코스를 불러오는 중입니다.</p></section></main>
  return <main className="app-shell result-shell">
    <header className="result-booking-header"><Link to="/" className="booking-brand">갈래말래</Link><Link to="/" className="back-button">나만의 코스 만들기</Link></header>
    <section className="result-intro result-booking-hero"><div><div className="eyebrow">SHARED TRIP</div><h1>{trip.title}</h1>{trip.description && <p>{trip.description}</p>}</div></section>
    <section className="route-card" style={{ maxWidth: 760, margin: '32px auto' }}>
      <div className="route-card-top"><div><span className="route-kicker">{trip.startArea}</span><h3>여행 장소 {trip.stops.length}곳</h3></div></div>
      <div className="timeline">{trip.stops.map((stop, index) => <div className="timeline-item" key={`${stop.placeId}-${index}`}><div className="timeline-time">{index + 1}</div><div className="timeline-line"><span className="timeline-dot"><Icon name="pin" size={14} /></span>{index < trip.stops.length - 1 && <i />}</div><div className="timeline-content"><strong>{stop.placeName}</strong><span>{stop.area}</span></div></div>)}</div>
    </section>
  </main>
}
