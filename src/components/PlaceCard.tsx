import { useEffect, useState } from 'react'
import type { ScoredPlace } from '../lib/scoring'
import type { Place } from '../types'
import Icon, { type IconName } from './Icon'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../lib/api'

const labels: Record<string, string> = { tour: '명소', photo: '포토 스팟', cafe: '카페', food: '맛집', activity: '액티비티', lodging: '숙소' }
const icons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity', lodging: 'bed' }

interface Review { id: string; user_id: string | null; user_name: string | null; content: string; rating: number; created_at: string; image_url?: string }

export default function PlaceCard({ index, scored, onRemove, onAdd, isSaved = false, onToggleSaved, onSelect, isCustomMode, isAdded }: { index: number; scored: ScoredPlace; onRemove?: (id: string) => void; onAdd?: (place: Place) => void; isSaved?: boolean; onToggleSaved?: () => void | Promise<void>; onSelect?: (id: string) => void; isCustomMode?: boolean; isAdded?: boolean }) {
  const { place } = scored
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewImage, setReviewImage] = useState('') // base64 data url
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showReviewList, setShowReviewList] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [favoriteError, setFavoriteError] = useState('')

  useEffect(() => { fetch(apiUrl(`/api/places/${encodeURIComponent(place.id)}/reviews?limit=5`)).then((r) => r.json()).then((b: { data?: Review[] }) => setReviews(b.data || [])).catch(() => setReviews([])) }, [place.id])

  const handleReviewImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setReviewError('이미지 파일만 업로드할 수 있어요.'); return }
    if (file.size > 5 * 1024 * 1024) { setReviewError('사진은 5MB 이하만 가능해요.'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      if (result.length > 7_100_000) { setReviewError('이미지가 너무 큽니다.'); return }
      setReviewImage(result)
      setReviewError('')
    }
    reader.readAsDataURL(file)
  }

  const submitReview = async () => {
    if (!user?.token) { setReviewError('로그인 후 후기를 남길 수 있어요.'); return }
    if (!reviewText.trim()) { setReviewError('후기 내용을 입력해 주세요.'); return }
    try {
      const res = await fetch(apiUrl(`/api/places/${encodeURIComponent(place.id)}/reviews`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ content: reviewText.trim(), rating: reviewRating, imageUrl: reviewImage }) })
      const body = await res.json() as { data?: Review & { image_url?: string }; error?: string }
      if (!res.ok || !body.data) { setReviewError(body.error || '후기를 등록하지 못했습니다.'); return }
      const saved: Review = { ...body.data!, image_url: (body.data as any).image_url || reviewImage } as Review
      setReviews((prev) => [saved, ...prev])
      setReviewText('')
      setReviewRating(5)
      setReviewImage('')
      setReviewError('')
      setShowReviewForm(false)
      setShowReviewList(true)
    } catch {
      setReviewError('후기를 등록하지 못했습니다.')
    }
  }

  const deleteReview = async (reviewId: string) => {
    if (!user?.token || !window.confirm('이 후기를 삭제하시겠습니까?')) return
    const res = await fetch(apiUrl(`/api/reviews/${reviewId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
    if (res.ok) setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    else setReviewError('후기를 삭제하지 못했습니다.')
  }

  const toggleSaved = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!user?.token) { setFavoriteError('찜 기능은 로그인 후 이용할 수 있습니다.'); return }
    try { await onToggleSaved?.(); setFavoriteError('') } catch (err) { setFavoriteError(err instanceof Error && (err as any).message === 'AUTH_REQUIRED' ? '찜 기능은 로그인 후 이용할 수 있습니다.' : '찜 상태를 변경하지 못했습니다.') }
  }

  return (
    <article className="place-card" onClick={() => onSelect?.(place.id)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
      <div className="place-image" style={{ background: 'linear-gradient(135deg, ' + place.accent + ', #202638)' }}>
        <img src={place.image} alt="" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        <span className="place-number">{index}</span><span className="place-category"><Icon name={icons[place.category]} size={14} /> {labels[place.category]}</span>
        <button type="button" className={'save-button' + (isSaved ? ' saved' : '')} aria-label={isSaved ? '찜 해제' : '찜하기'} aria-pressed={isSaved} onClick={toggleSaved}><Icon name="heart" size={16} /></button>
      </div>
      <div className="place-body">
        <div className="place-title-row"><div><div className="place-area">{place.area} · {labels[place.category]}</div><h3>{place.name}</h3></div><div className="score-badge"><strong>{scored.score}</strong><small>추천점수</small></div></div>
        <p className="place-description">{place.description}</p>
        <div className="place-meta"><span><Icon name="star" size={11} /> {place.rating || '후기 없음'}</span><span>{place.indoor ? '실내' : '야외'}</span><span>가격 정보는 장소 상세에서 확인</span></div>
        <div className="reason-row">{scored.reasons.slice(0, 2).map((r) => <span key={r}>✓ {r}</span>)}</div>
        {favoriteError && <p style={{ margin:'8px 0 0', color:'#b34d4d', fontSize:11 }}>{favoriteError}</p>}
        {place.lodging && <div className="detail-box lodging-detail"><strong>숙박 장소</strong><span>가격 정보는 장소 상세에서 확인 · {place.lodging.capacity}인 · {place.lodging.parking ? '주차 가능' : '주차 정보 확인 필요'}</span></div>}
        {place.menu && <div className="detail-box menu-detail"><strong>대표 메뉴</strong><span>{place.menu.slice(0,3).map((m)=> m.name+' '+m.price.toLocaleString()+'원').join('  ·  ')}</span></div>}

        <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:6, padding:'7px 10px', border:'1px solid #e8ece7', borderRadius:8, background:'#f8fafb' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4, color:'#5a6d8a', fontSize:11, fontWeight:700 }}><Icon name="star" size={11} /> 후기 {reviews.length}개</span>
          <button type="button" onClick={(e)=>{e.stopPropagation(); setShowReviewList(v=>!v)}} style={{ marginLeft:'auto', border:'1px solid #dbe4f0', background: showReviewList ? '#eaf2ff' : '#fff', color: showReviewList ? '#2878f0' : '#5a6d8a', borderRadius:6, padding:'4px 8px', fontSize:10, fontWeight:700 }}>{showReviewList ? '접기' : '미리보기'}</button>
          <button type="button" onClick={(e)=>{e.stopPropagation(); setReviewError(user ? '' : '로그인 후 후기를 남길 수 있어요.'); setShowReviewForm(true); setShowReviewList(true)}} style={{ border:0, background:'#2878f0', color:'#fff', borderRadius:6, padding:'4px 10px', fontSize:10, fontWeight:700 }}>쓰기</button>
        </div>

        {showReviewList && (
          <div className="modal-backdrop" onClick={(e)=>{e.stopPropagation(); setShowReviewList(false)}} style={{ position:'fixed', inset:0, zIndex:100, display:'grid', placeItems:'center', padding:20, background:'rgba(15,23,42,.45)', backdropFilter:'blur(4px)' }}>
            <div onClick={(e)=>e.stopPropagation()} style={{ width:'min(100%, 440px)', maxHeight:'72vh', display:'flex', flexDirection:'column', overflow:'hidden', borderRadius:16, background:'#fff', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
              <div style={{ padding:'16px 18px 12px', borderBottom:'1px solid #e8ece7', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <strong style={{ fontSize:13 }}>{place.name} 후기 {reviews.length}개</strong>
                <button type="button" onClick={()=>setShowReviewList(false)} style={{ border:0, background:'#f1f5f9', width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center', cursor:'pointer' }}>×</button>
              </div>
              <div style={{ flex:'1 1 auto', overflowY:'auto', padding:'12px 14px', display:'grid', gap:10 }}>
                {reviews.length===0 ? <p style={{margin:0, color:'#8b97aa', fontSize:12, textAlign:'center', padding:'20px 0'}}>아직 후기가 없어요. 첫 후기를 남겨보세요!</p> : reviews.map((r)=>(
                  <div key={r.id} style={{ padding:'10px', border:'1px solid #e8ece7', borderRadius:10, background:'#f8fafb' }}>
                    <div style={{display:'flex', alignItems:'center', gap:6}}>
                      <span style={{color:'#f4b448', fontSize:11}}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>
                      <span style={{color:'#aab5ac', fontSize:9, marginLeft:'auto'}}>{r.user_name || '익명'} · {new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                      {r.user_id===user?.id && <button type="button" onClick={()=>deleteReview(r.id)} style={{border:0, background:'transparent', color:'#b34d4d', fontSize:10, cursor:'pointer'}}>삭제</button>}
                    </div>
                    <p style={{margin:'6px 0 0', color:'#334155', fontSize:12, lineHeight:1.6, whiteSpace:'pre-wrap'}}>{r.content}</p>
                    {(r as any).image_url && (
                      <img src={(r as any).image_url} alt="후기 사진" style={{ display:'block', marginTop:8, width:'100%', maxHeight:160, objectFit:'cover', borderRadius:8, border:'1px solid #e8ece7' }} onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none' }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding:'10px 14px', borderTop:'1px solid #e8ece7', display:'flex', gap:8 }}>
                <button type="button" onClick={()=>setShowReviewList(false)} style={{ flex:1, padding:'8px', border:'1px solid #e2e8f0', borderRadius:8, background:'#fff', fontSize:12 }}>닫기</button>
                <button type="button" onClick={()=>{ setShowReviewList(false); setShowReviewForm(true)}} style={{ flex:1, padding:'8px', border:0, borderRadius:8, background:'#2878f0', color:'#fff', fontSize:12, fontWeight:700 }}>후기 쓰기</button>
              </div>
            </div>
          </div>
        )}

        {showReviewForm && (
          <div onClick={(e)=>e.stopPropagation()} style={{ marginTop:8, padding:10, borderRadius:10, border:'1px solid #dceee5', background:'#f4fbf7' }}>
            <strong style={{display:'block', marginBottom:6, fontSize:11}}>후기를 남겨주세요</strong>
            <div style={{display:'flex', gap:3, marginBottom:6}}>{[1,2,3,4,5].map(s=><button key={s} type="button" onClick={()=>setReviewRating(s)} style={{border:0, background:'transparent', cursor:'pointer', fontSize:16, color: s<=reviewRating ? '#f4b448' : '#d6ddd7'}}>★</button>)}</div>
            <textarea value={reviewText} onChange={(e)=>setReviewText(e.target.value)} placeholder="방문 후기를 남겨주세요..." rows={2} style={{width:'100%', padding:'7px 9px', border:'1px solid #dceee5', borderRadius:8, resize:'vertical', fontSize:11, fontFamily:'inherit', outline:'none', minHeight:48}} />
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
              <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 9px', border:'1px solid #dbe4f0', borderRadius:6, background:'#fff', color:'#5a6d8a', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                <Icon name="camera" size={12} /> 사진 추가
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReviewImage} style={{ display:'none' }} onClick={(e)=>e.stopPropagation()} />
              </label>
              {reviewImage && <span style={{ color:'#2878f0', fontSize:10 }}>사진 1장 선택됨</span>}
              {reviewImage && <button type="button" onClick={(e)=>{e.stopPropagation(); setReviewImage('')}} style={{ border:0, background:'transparent', color:'#b34d4d', fontSize:10, cursor:'pointer' }}>제거</button>}
            </div>
            {reviewImage && <img src={reviewImage} alt="미리보기" style={{ display:'block', marginTop:8, width:'100%', maxHeight:120, objectFit:'cover', borderRadius:8, border:'1px solid #dceee5' }} />}
            {reviewError && <p style={{margin:'5px 0 0', color:'#b34d4d', fontSize:10}}>{reviewError}</p>}
            <div style={{display:'flex', gap:6, marginTop:8}}>
              <button type="button" className="ghost-button" onClick={(e)=>{e.stopPropagation(); setShowReviewForm(false); setReviewImage('')}} style={{flex:1, minHeight:30, fontSize:11}}>취소</button>
              <button type="button" className="primary-button" onClick={(e)=>{e.stopPropagation(); submitReview()}} style={{flex:1, minHeight:30, fontSize:11}}>등록</button>
            </div>
          </div>
        )}

        <div className="place-actions" style={{marginTop:12}}>
          {isCustomMode ? (
            <button type="button" onClick={(e)=>{e.stopPropagation(); onAdd?.(place)}} disabled={isAdded} className="ghost-button" style={{ background: isAdded ? '#eaf3ff' : undefined, color: isAdded ? '#2878f0' : undefined, borderColor: isAdded ? '#a8caff' : undefined }}>
              <Icon name={isAdded ? 'check' : 'plus'} size={13} /> {isAdded ? '담김' : '코스에 담기'}
            </button>
          ) : (
            onRemove && <button type="button" onClick={(e)=>{e.stopPropagation(); onRemove(place.id)}} className="ghost-button"><Icon name="close" size={13} /> 이 장소는 빼기</button>
          )}
          <a href={place.placeUrl || ('https://map.kakao.com/?q=' + encodeURIComponent(place.name))} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="ghost-button">지도에서 보기 <Icon name="arrow" size={13} /></a>
        </div>
      </div>
    </article>
  )
}
