import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { deleteTrip, getTrip, updateTrip, type Trip, type TripInput, type TripStopInput } from '../lib/tripsApi'
import { useTrips } from '../trips/TripsContext'

type Notice = { kind: 'success' | 'error'; text: string } | null
const dayOf = (stop: TripStopInput) => Number.isInteger(stop.metadata?.dayIndex) ? Number(stop.metadata.dayIndex) : 0

function copyLink(token: string | null) {
  if (!token) return Promise.reject(new Error('공개 코스로 전환한 뒤 링크를 복사할 수 있습니다.'))
  const link = `${window.location.origin}/share/trips/${token}`
  return navigator.clipboard?.writeText(link) ?? Promise.resolve(window.prompt('공유 링크를 복사해주세요.', link))
}

export default function Trips() {
  const { user } = useAuth()
  const { trips, tripsLoading, tripsError, refreshTrips } = useTrips()
  const [selected, setSelected] = useState<Trip | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [drag, setDrag] = useState<{ day: number; index: number } | null>(null)

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(null), 3500); return () => window.clearTimeout(timer) }, [notice])
  const days = useMemo(() => {
    if (!selected) return [] as TripStopInput[][]
    const count = Math.max(1, Math.round((new Date(selected.dateEnd).getTime() - new Date(selected.dateStart).getTime()) / 86400000) + 1 || 1)
    return Array.from({ length: count }, (_, day) => selected.stops.filter((stop) => dayOf(stop) === day))
  }, [selected])

  const openTrip = async (id: string) => {
    if (!user?.token) { setNotice({ kind: 'error', text: '로그인 후 내 코스를 확인할 수 있습니다.' }); return }
    setLoadingDetail(true); setNotice(null)
    try { setSelected(await getTrip(id, user.token)) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 불러오지 못했습니다.' }) }
    finally { setLoadingDetail(false) }
  }
  const updateSelected = (patch: Partial<Trip>) => setSelected((current) => current ? { ...current, ...patch } : current)
  const save = async (next?: Trip) => {
    const trip = next || selected
    if (!trip || !user?.token) return setNotice({ kind: 'error', text: '로그인이 만료되었습니다. 다시 로그인해주세요.' })
    setBusy(true)
    try {
      const input: TripInput = { title: trip.title, description: trip.description, startArea: trip.startArea, dateStart: trip.dateStart, dateEnd: trip.dateEnd, companion: trip.companion, headcount: trip.headcount, budgetPerPerson: trip.budgetPerPerson, transport: trip.transport, weather: trip.weather, likes: trip.likes, dislikes: trip.dislikes, routeCoordinates: trip.routeCoordinates, isPublic: trip.isPublic, stops: trip.stops }
      const updated = await updateTrip(trip.id, input, user.token)
      setSelected(updated); await refreshTrips(); setNotice({ kind: 'success', text: '코스를 저장했습니다.' })
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 저장하지 못했습니다.' }) }
    finally { setBusy(false) }
  }
  const togglePublic = async () => { if (!selected) return; await save({ ...selected, isPublic: !selected.isPublic }) }
  const remove = async () => {
    if (!selected || !user?.token || !window.confirm('이 코스를 삭제할까요?')) return
    setBusy(true)
    try { await deleteTrip(selected.id, user.token); setSelected(null); await refreshTrips(); setNotice({ kind: 'success', text: '코스를 삭제했습니다.' }) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 삭제하지 못했습니다.' }) }
    finally { setBusy(false) }
  }
  const moveStop = (day: number, from: number, to: number) => {
    if (!selected || from === to) return
    const group = [...days[day]]; const [moved] = group.splice(from, 1); group.splice(to, 0, moved)
    const remainder = selected.stops.filter((stop) => dayOf(stop) !== day)
    const withDay = group.map((stop) => ({ ...stop, metadata: { ...stop.metadata, dayIndex: day } }))
    const ordered = [...remainder, ...withDay].sort((a, b) => dayOf(a) - dayOf(b))
    setSelected({ ...selected, stops: ordered })
  }

  if (!user) return <main className="app-shell result-shell"><section className="saved-empty"><h1>내 코스</h1><p>로그인 후 저장한 여행 코스를 관리할 수 있어요.</p><Link to="/" className="primary-button">메인으로 이동</Link></section></main>
  return <main className="app-shell result-shell">
    <header className="topbar result-topbar"><Link to="/" className="brand">갈래말래</Link><div className="result-top-actions"><Link to="/saved" className="saved-count">찜한 장소</Link><Link to="/" className="back-button">새 코스 찾기</Link><AuthActions /></div></header>
    {notice && <div className={`trip-toast ${notice.kind}`} role="status" aria-live="polite">{notice.text}</div>}
    <section className="result-intro"><div><div className="eyebrow">MY TRIPS</div><h1>저장한 <em>여행 코스</em></h1><p>일정과 장소 순서를 수정하고, 공개 링크로 공유할 수 있어요.</p></div></section>
    <section className="trips-layout">
      <aside className="trip-list-panel" aria-label="저장한 코스 목록"><div className="section-heading"><h2>내 코스</h2><span className="result-count">{trips.length}개</span></div>
        {tripsLoading ? <div className="saved-empty">코스를 불러오는 중입니다.</div> : tripsError ? <div className="saved-empty"><p>{tripsError}</p><button type="button" className="ghost-button" onClick={() => void refreshTrips()}>다시 시도</button></div> : trips.length === 0 ? <div className="saved-empty"><Icon name="route" size={28} /><p>아직 저장한 코스가 없어요.</p><Link to="/" className="back-button">코스 추천받기</Link></div> : <div className="trip-list">{trips.map((trip) => <button type="button" key={trip.id} className={'trip-list-item' + (selected?.id === trip.id ? ' active' : '')} onClick={() => void openTrip(trip.id)} aria-current={selected?.id === trip.id ? 'true' : undefined}><strong>{trip.title}</strong><span>{trip.startArea} · {trip.stopCount ?? trip.stops.length}곳 · {trip.isPublic ? '공개' : '비공개'}</span></button>)}</div>}
      </aside>
      <section className="trip-editor" aria-live="polite">{loadingDetail ? <div className="saved-empty">코스를 불러오는 중입니다.</div> : !selected ? <div className="saved-empty"><Icon name="route" size={28} /><p>왼쪽 목록에서 관리할 코스를 선택해주세요.</p></div> : <>
        <div className="trip-editor-actions"><label>코스 이름<input value={selected.title} maxLength={120} onChange={(event) => updateSelected({ title: event.target.value })} /></label><label>설명<textarea value={selected.description} maxLength={4000} onChange={(event) => updateSelected({ description: event.target.value })} /></label></div>
        <div className="trip-editor-toolbar"><button type="button" className={'ghost-button' + (selected.isPublic ? ' active' : '')} onClick={() => void togglePublic()} disabled={busy} aria-pressed={selected.isPublic}>{selected.isPublic ? '공개 코스' : '비공개 코스'}</button><button type="button" className="ghost-button" onClick={() => copyLink(selected.shareToken).then(() => setNotice({ kind: 'success', text: '공유 링크를 복사했습니다.' })).catch((error: Error) => setNotice({ kind: 'error', text: error.message }))} disabled={!selected.isPublic}>링크 복사</button><button type="button" className="primary-button" onClick={() => void save()} disabled={busy}>저장</button><button type="button" className="ghost-button danger-button" onClick={() => void remove()} disabled={busy}>삭제</button></div>
        <p className="trip-help">장소를 드래그하거나 키보드의 ↑/↓ 버튼으로 일정 순서를 바꿀 수 있습니다.</p>
        {days.map((stops, day) => <section className="trip-day" key={day}><h3>DAY {day + 1}</h3>{stops.length === 0 ? <p className="trip-empty-day">등록된 장소가 없습니다.</p> : stops.map((stop, index) => <div key={`${stop.placeId}-${index}`} className="trip-stop" draggable onDragStart={() => setDrag({ day, index })} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (drag?.day === day) moveStop(day, drag.index, index); setDrag(null) }}><span>{index + 1}</span><div><strong>{stop.placeName}</strong><small>{stop.area}</small></div><div className="trip-stop-controls"><button type="button" aria-label={`${stop.placeName} 위로 이동`} disabled={index === 0} onClick={() => moveStop(day, index, index - 1)}>↑</button><button type="button" aria-label={`${stop.placeName} 아래로 이동`} disabled={index === stops.length - 1} onClick={() => moveStop(day, index, index + 1)}>↓</button></div></div>)}</section>)}
      </>}</section>
    </section><BottomNav />
  </main>
}
