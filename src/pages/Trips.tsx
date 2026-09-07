import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { createTrip, deleteTrip, getTrip, updateTrip, type Trip, type TripInput, type TripStopInput } from '../lib/tripsApi'
import { useTrips } from '../trips/TripsContext'

type Notice = { kind: 'success' | 'error'; text: string } | null
const dayOf = (stop: TripStopInput) => Number.isInteger(stop.metadata?.dayIndex) ? Number(stop.metadata.dayIndex) : 0
const copyLink = (token: string | null) => token ? navigator.clipboard?.writeText(`${window.location.origin}/share/trips/${token}`) ?? Promise.resolve() : Promise.reject(new Error('공개 코스로 전환한 뒤 링크를 복사할 수 있습니다.'))
const manualStop = (day: number, area: string): TripStopInput => ({ placeId: `manual-${crypto.randomUUID()}`, placeName: '새 장소', category: 'tour', area, latitude: 37.5665, longitude: 126.978, estimatedCost: 0, durationMin: 60, metadata: { dayIndex: day, note: '' } })

export default function Trips() {
  const { user } = useAuth()
  const { trips, tripsLoading, tripsError, refreshTrips } = useTrips()
  const [selected, setSelected] = useState<Trip | null>(null)
  const [savedCopy, setSavedCopy] = useState<Trip | null>(null)
  const [editing, setEditing] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [drag, setDrag] = useState<{ day: number; index: number } | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 3500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const days = useMemo(() => {
    if (!selected) return [] as TripStopInput[][]
    const count = Math.max(1, Math.round((new Date(selected.dateEnd).getTime() - new Date(selected.dateStart).getTime()) / 86400000) + 1 || 1)
    return Array.from({ length: count }, (_, day) => selected.stops.filter((stop) => dayOf(stop) === day))
  }, [selected])

  const inputOf = (trip: Trip): TripInput => ({ title: trip.title, description: trip.description, startArea: trip.startArea, dateStart: trip.dateStart, dateEnd: trip.dateEnd, companion: trip.companion, headcount: trip.headcount, budgetPerPerson: trip.budgetPerPerson, transport: trip.transport, weather: trip.weather, likes: trip.likes, dislikes: trip.dislikes, routeCoordinates: trip.routeCoordinates, isPublic: trip.isPublic, stops: trip.stops })

  const openTrip = async (id: string) => {
    if (!user?.token || (editing && selected && !window.confirm('저장하지 않은 수정 내용을 취소할까요?'))) return
    setLoadingDetail(true)
    try { const trip = await getTrip(id, user.token); setSelected(trip); setSavedCopy(trip); setEditing(false) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 불러오지 못했습니다.' }) }
    finally { setLoadingDetail(false) }
  }

  const save = async () => {
    if (!selected || !user?.token) return
    if (!selected.title.trim() || selected.stops.some((stop) => !stop.placeName.trim())) return setNotice({ kind: 'error', text: '코스 이름과 장소 이름을 입력해 주세요.' })
    setBusy(true)
    try {
      const updated = selected.id.startsWith('draft-') ? await createTrip(inputOf(selected), user.token) : await updateTrip(selected.id, inputOf(selected), user.token)
      setSelected(updated); setSavedCopy(updated); setEditing(false)
      await refreshTrips(); setNotice({ kind: 'success', text: '코스를 저장했습니다.' })
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 저장하지 못했습니다.' }) }
    finally { setBusy(false) }
  }

  const remove = async () => {
    if (!selected || !user?.token || !window.confirm('이 코스를 삭제할까요?')) return
    if (selected.id.startsWith('draft-')) { setSelected(null); setSavedCopy(null); setEditing(false); return }
    setBusy(true)
    try { await deleteTrip(selected.id, user.token); setSelected(null); setSavedCopy(null); setEditing(false); await refreshTrips(); setNotice({ kind: 'success', text: '코스를 삭제했습니다.' }) }
    catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : '코스를 삭제하지 못했습니다.' }) }
    finally { setBusy(false) }
  }

  const createManual = () => {
    if (editing && selected && !window.confirm('저장하지 않은 수정 내용을 취소하고 새 코스를 만들까요?')) return
    const today = new Date().toISOString().slice(0, 10)
    const input: TripInput = { title: '새 여행 코스', description: '', startArea: '서울', dateStart: today, dateEnd: today, companion: 'alone', headcount: 1, budgetPerPerson: 0, transport: 'public', weather: 'sunny', likes: [], dislikes: [], routeCoordinates: [], isPublic: false, stops: [manualStop(0, '서울')] }
    const now = new Date().toISOString()
    setSelected({ ...input, id: `draft-${crypto.randomUUID()}`, shareToken: null, createdAt: now, updatedAt: now }); setSavedCopy(null); setEditing(true); setNotice(null)
  }

  const patchTrip = (patch: Partial<Trip>) => setSelected((current) => current ? { ...current, ...patch } : current)
  const move = (day: number, from: number, to: number) => {
    if (!selected || from === to) return
    const group = [...days[day]]; const [item] = group.splice(from, 1); group.splice(to, 0, item)
    const other = selected.stops.filter((stop) => dayOf(stop) !== day)
    patchTrip({ stops: [...other, ...group.map((stop) => ({ ...stop, metadata: { ...stop.metadata, dayIndex: day } }))].sort((a, b) => dayOf(a) - dayOf(b)) })
  }
  const patchStop = (day: number, index: number, patch: Partial<TripStopInput>) => {
    if (!selected) return
    const target = days[day][index]
    patchTrip({ stops: selected.stops.map((stop) => stop === target ? { ...stop, ...patch } : stop) })
  }
  const removeStop = (day: number, index: number) => {
    if (!selected || selected.stops.length < 2) return setNotice({ kind: 'error', text: '코스에는 장소가 한 곳 이상 필요합니다.' })
    const target = days[day][index]
    patchTrip({ stops: selected.stops.filter((stop) => stop !== target) })
  }

  if (!user) return <main className="app-shell result-shell"><section className="saved-empty"><h1>내 코스</h1><p>로그인 후 저장한 여행 코스를 관리할 수 있어요.</p><Link to="/" className="primary-button">메인으로 이동</Link></section></main>

  return <main className="app-shell result-shell">
    <header className="topbar result-topbar"><Link to="/" className="brand">갈래말래</Link><div className="result-top-actions"><Link to="/saved" className="saved-count">찜한 장소</Link><Link to="/" className="back-button">새 코스 찾기</Link><AuthActions /></div></header>
    {notice && <div className={`trip-toast ${notice.kind}`} role="status">{notice.text}</div>}
    <section className="result-intro"><div><div className="eyebrow">MY TRIPS</div><h1>저장한 <em>여행 코스</em></h1><p>직접 장소를 추가하고, 순서와 설명을 편집할 수 있어요.</p></div></section>
    <section className="trips-layout">
      <aside className="trip-list-panel">
        <div className="section-heading"><h2>내 코스</h2><span className="result-count">{trips.length}개</span></div>
        <button type="button" className="primary-button trip-new-button" onClick={createManual} disabled={busy}>+ 직접 코스 추가</button>
        {tripsLoading ? <div className="saved-empty">코스를 불러오는 중입니다.</div> : tripsError ? <div className="saved-empty">{tripsError}</div> : <div className="trip-list">{trips.map((trip) => <button type="button" key={trip.id} className={'trip-list-item' + (selected?.id === trip.id ? ' active' : '')} onClick={() => void openTrip(trip.id)}><strong>{trip.title}</strong><span>{trip.startArea} · {trip.stopCount ?? trip.stops.length}곳</span></button>)}</div>}
      </aside>
      <section className={'trip-editor' + (editing ? ' is-editing' : '')}>
        {loadingDetail ? <div className="saved-empty">코스를 불러오는 중입니다.</div> : !selected ? <div className="saved-empty"><Icon name="route" size={28} /><p>왼쪽 목록에서 관리할 코스를 선택해 주세요.</p></div> : <>
          <div className="edit-state-label">{editing ? '편집 중 · 완료를 누르면 저장됩니다' : '보기 모드'}</div>
          {editing ? <div className="trip-editor-actions">
            <label>코스 이름<input value={selected.title} maxLength={120} onChange={(event) => patchTrip({ title: event.target.value })} /></label>
            <label>코스 설명<textarea value={selected.description} maxLength={4000} onChange={(event) => patchTrip({ description: event.target.value })} /></label>
            <div className="trip-basic-fields"><label>출발 지역<input value={selected.startArea} maxLength={255} onChange={(event) => patchTrip({ startArea: event.target.value })} /></label><label>시작일<input type="date" value={selected.dateStart} onChange={(event) => patchTrip({ dateStart: event.target.value, dateEnd: event.target.value > selected.dateEnd ? event.target.value : selected.dateEnd })} /></label><label>종료일<input type="date" min={selected.dateStart} value={selected.dateEnd} onChange={(event) => patchTrip({ dateEnd: event.target.value })} /></label></div>
            <label className="trip-public-toggle"><input type="checkbox" checked={selected.isPublic} onChange={(event) => patchTrip({ isPublic: event.target.checked })} /> 공유 가능한 공개 코스로 저장</label>
          </div> : <div className="trip-view-summary"><h2>{selected.title}</h2><p>{selected.description || '등록된 코스 설명이 없습니다.'}</p><small>{selected.startArea} · {selected.dateStart} ~ {selected.dateEnd} · {selected.isPublic ? '공개' : '비공개'}</small></div>}
          <div className="trip-editor-toolbar">{editing ? <><button type="button" className="primary-button" onClick={() => void save()} disabled={busy}>{selected.id.startsWith('draft-') ? '완료' : '수정 완료'}</button><button type="button" className="ghost-button" onClick={() => { setSelected(savedCopy); setEditing(false) }} disabled={busy}>취소</button></> : <button type="button" className="primary-button" onClick={() => setEditing(true)}>수정하기</button>}<button type="button" className="ghost-button" onClick={() => copyLink(selected.shareToken).then(() => setNotice({ kind: 'success', text: '링크를 복사했습니다.' })).catch((error: Error) => setNotice({ kind: 'error', text: error.message }))} disabled={!selected.isPublic || editing}>링크 복사</button><button type="button" className="ghost-button danger-button" onClick={() => void remove()} disabled={busy}>삭제</button></div>
          {days.map((stops, day) => <section className="trip-day" key={day}><h3>DAY {day + 1}</h3>{stops.length === 0 && <p className="trip-empty-day">등록된 장소가 없습니다.</p>}{stops.map((stop, index) => <div key={`${stop.placeId}-${index}`} className="trip-stop" draggable={editing} onDragStart={() => setDrag({ day, index })} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (editing && drag?.day === day) move(day, drag.index, index); setDrag(null) }}><span>{index + 1}</span>{editing ? <div className="trip-stop-edit"><input value={stop.placeName} aria-label="장소 이름" onChange={(event) => patchStop(day, index, { placeName: event.target.value })} /><input value={stop.area} aria-label="장소 지역" onChange={(event) => patchStop(day, index, { area: event.target.value })} /><input value={String(stop.metadata.note || '')} aria-label="장소 설명" placeholder="장소 설명" onChange={(event) => patchStop(day, index, { metadata: { ...stop.metadata, note: event.target.value } })} /></div> : <div><strong>{stop.placeName}</strong><small>{stop.area}{typeof stop.metadata.note === 'string' && stop.metadata.note ? ` · ${stop.metadata.note}` : ''}</small></div>}{editing && <div className="trip-stop-controls"><button type="button" aria-label="위로 이동" disabled={index === 0} onClick={() => move(day, index, index - 1)}>↑</button><button type="button" aria-label="아래로 이동" disabled={index === stops.length - 1} onClick={() => move(day, index, index + 1)}>↓</button><button type="button" aria-label="장소 삭제" onClick={() => removeStop(day, index)}>×</button></div>}</div>)}{editing && <button type="button" className="trip-add-stop" onClick={() => patchTrip({ stops: [...selected.stops, manualStop(day, selected.startArea)] })}>+ 장소 추가</button>}</section>)}
        </>}
      </section>
    </section>
    <BottomNav />
  </main>
}
