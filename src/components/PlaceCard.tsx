import { useEffect, useRef, useState } from 'react'
import type { ScoredPlace } from '../lib/scoring'
import Icon, { type IconName } from './Icon'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../lib/api'
import { rememberCachedReview, removeCachedReview } from '../lib/reviewCache'

const labels: Record<string, string> = { tour: '관광지', photo: '포토 스팟', cafe: '카페', food: '맛집', activity: '액티비티' }
const icons: Record<string, IconName> = { tour: 'nature', photo: 'photo', cafe: 'cafe', food: 'food', activity: 'activity' }
interface ReviewSummary { placeId: string; rating: number; reviewCount: number }
interface Review { id: string; place_id?: string; place_name?: string; user_id: string | null; user_name: string | null; content: string; rating: number; image_url?: string; created_at: string; summary?: ReviewSummary }

async function compressImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 첨부할 수 있어요.')
  const objectUrl = URL.createObjectURL(file)
  const source = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'))
    image.src = objectUrl
  }).finally(() => URL.revokeObjectURL(objectUrl))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('사진을 준비하지 못했습니다.')
  for (const maxSide of [1200, 1024, 880]) {
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    context.drawImage(source, 0, 0, canvas.width, canvas.height)
    for (const quality of [.76, .66, .56]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= 520_000) return dataUrl
    }
  }
  throw new Error('사진 크기를 줄이지 못했습니다. 다른 사진을 선택해 주세요.')
}

async function readResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  try { return JSON.parse(raw) as T } catch { return {} as T }
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export default function PlaceCard({ index, scored, onRemove, isSaved = false, onToggleSaved, showUnsaveAction = false, onSelect, onReviewSummary, inCourse = false, onCourseToggle }: { index: number; scored: ScoredPlace; onRemove?: (id: string) => void; isSaved?: boolean; onToggleSaved?: () => void | Promise<void>; showUnsaveAction?: boolean; onSelect?: (id: string) => void; onReviewSummary?: (summary: ReviewSummary) => void; inCourse?: boolean; onCourseToggle?: () => void }) {
  const { place } = scored
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [imageUrl, setImageUrl] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [selectedReview, setSelectedReview] = useState<Review | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [favoriteError, setFavoriteError] = useState('')
  const [updatingFavorite, setUpdatingFavorite] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState('')

  useEffect(() => {
    fetch(apiUrl(`/api/places/${encodeURIComponent(place.id)}/reviews?limit=20`))
      .then((response) => response.json())
      .then((body: { data?: Review[] }) => setReviews(body.data || []))
      .catch(() => setReviews([]))
  }, [place.id])

  const closeForm = () => {
    setShowReviewForm(false)
    setReviewText('')
    setImageUrl('')
    setReviewError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const openReviewForm = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setReviewError(user ? '' : '로그인 후 후기를 남길 수 있어요.')
    setShowReviewForm(true)
  }

  const submitReview = async () => {
    if (!user?.token) return setReviewError('로그인 후 후기를 작성할 수 있어요.')
    if (!reviewText.trim() && !imageUrl) return setReviewError('후기 내용 또는 사진을 첨부해 주세요.')
    if (submittingReview) return
    setSubmittingReview(true)
    setReviewError('')
    const payload = JSON.stringify({ content: reviewText.trim(), rating: reviewRating, imageUrl, placeName: place.name })
    try {
      let lastError = '리뷰를 등록하지 못했습니다.'
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(apiUrl(`/api/places/${encodeURIComponent(place.id)}/reviews`), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: payload })
          const body = await readResponse<{ data?: Review; error?: string }>(response)
          if (response.ok && body.data) {
            const review = { ...body.data, place_id: body.data.place_id || place.id, place_name: body.data.place_name || place.name, user_id: body.data.user_id || user.id, user_name: body.data.user_name || user.name }
            setReviews((current) => [review, ...current])
            rememberCachedReview(user.id, { id: review.id, place_id: review.place_id, place_name: review.place_name, rating: review.rating, content: review.content, image_url: review.image_url, created_at: review.created_at })
            if (body.data.summary) onReviewSummary?.(body.data.summary)
            window.dispatchEvent(new Event('where:review-saved'))
            closeForm()
            return
          }
          lastError = body.error || lastError
          if (![502, 503, 504].includes(response.status)) break
        } catch { lastError = '리뷰 서버와 연결하지 못했습니다.' }
        if (attempt < 2) { setReviewError('리뷰 서버와 다시 연결 중이에요. 잠시만 기다려 주세요.'); await wait((attempt + 1) * 1_000) }
      }
      setReviewError(lastError)
    } finally { setSubmittingReview(false) }
  }

  const deleteReview = async (reviewId: string) => {
    if (!user?.token || deletingReviewId || !window.confirm('이 후기를 삭제할까요?')) return
    setDeletingReviewId(reviewId)
    setReviewError('')
    try {
      const response = await fetch(apiUrl(`/api/reviews/${reviewId}`), { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
      const body = await readResponse<{ error?: string }>(response)
      if (!response.ok) return setReviewError(body.error || '후기를 삭제하지 못했습니다.')
      const remaining = reviews.filter((review) => review.id !== reviewId)
      setReviews(remaining)
      setSelectedReview(remaining[0] || null)
      removeCachedReview(user.id, reviewId)
      window.dispatchEvent(new Event('where:review-saved'))
    } catch { setReviewError('후기 삭제 서버와 연결하지 못했습니다.') }
    finally { setDeletingReviewId('') }
  }

  const selectImage = async (file?: File) => {
    if (!file) return
    try { setImageUrl(await compressImage(file)); setReviewError('') }
    catch (error) { setImageUrl(''); setReviewError(error instanceof Error ? error.message : '사진을 준비하지 못했습니다.') }
  }

  const toggleSaved = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!user?.token) return setFavoriteError('찜 기능은 로그인 후 이용할 수 있어요.')
    if (updatingFavorite) return
    setUpdatingFavorite(true)
    try { await onToggleSaved?.(); setFavoriteError('') }
    catch { setFavoriteError('찜 상태를 변경하지 못했습니다.') }
    finally { setUpdatingFavorite(false) }
  }

  return <article className="place-card" onClick={() => onSelect?.(place.id)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
    <div className="place-image" style={{ background: `linear-gradient(135deg, ${place.accent}, #202638)` }}>
      {place.image && <img src={place.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
      <span className="place-number">{index}</span>
      <span className="place-category"><Icon name={icons[place.category]} size={14} /> {labels[place.category]}</span>
      <button type="button" className={'save-button' + (isSaved ? ' saved' : '')} aria-label={isSaved ? '찜 해제' : '찜하기'} onClick={toggleSaved} disabled={updatingFavorite}><Icon name="heart" size={16} /></button>
    </div>
    <div className="place-body">
      <div className="place-title-row"><div><div className="place-area">{place.area} · {labels[place.category]}</div><h3>{place.name}</h3></div><button type="button" className="review-quick-action" onClick={openReviewForm}><Icon name="camera" size={13} /> 리뷰 작성</button></div>
      <p className="place-description clamp-text">{place.description}</p>
      <div className="place-meta"><span><Icon name="star" size={11} /> {place.rating || '후기 없음'}</span><span>{place.indoor ? '실내' : '실외'}</span></div>
      <div className="reason-row">{scored.reasons.slice(0, 2).map((reason) => <span key={reason}>#{reason}</span>)}</div>
      {favoriteError && <p className="inline-error">{favoriteError}</p>}
      {reviews.length > 0 && <div className="review-list">{reviews.slice(0, 1).map((review) => <button className="review-preview" type="button" key={review.id} aria-label="리뷰 전체 보기" onClick={(event) => { event.stopPropagation(); setSelectedReview(review) }}><strong>후기 {reviews.length}</strong><span className="review-stars">★ {review.rating}</span><p>{review.content}</p><span className="review-open-label">전체보기</span></button>)}</div>}
      {showReviewForm && <div className="review-form" onClick={(event) => event.stopPropagation()}><strong>방문 후기를 남겨주세요</strong><div className="star-picker">{[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" onClick={() => setReviewRating(star)} disabled={submittingReview}>{star <= reviewRating ? '★' : '☆'}</button>)}</div><textarea value={reviewText} maxLength={1000} onChange={(event) => setReviewText(event.target.value)} placeholder="방문 후기를 남겨주세요." rows={3} disabled={submittingReview} /><input ref={fileRef} type="file" accept="image/*" hidden onClick={(event) => { event.currentTarget.value = '' }} onChange={(event) => { const selectedFile = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectImage(selectedFile) }} />{imageUrl && <div className="review-image-preview"><img src={imageUrl} alt="첨부 사진 미리보기" /><button type="button" onClick={() => setImageUrl('')} disabled={submittingReview}>사진 제거</button></div>}<button type="button" className="image-attach-button" onClick={(event) => { event.stopPropagation(); fileRef.current?.click() }} disabled={submittingReview}><Icon name="camera" size={13} /> 사진 첨부</button>{reviewError && <p className="inline-error">{reviewError}</p>}<div className="review-form-actions"><button type="button" className="ghost-button" onClick={closeForm} disabled={submittingReview}>취소</button><button type="button" className="primary-button" onClick={() => void submitReview()} disabled={submittingReview}>{submittingReview ? '저장 중...' : '완료'}</button></div></div>}
      {!showReviewForm && <button type="button" className="ghost-button review-write" onClick={openReviewForm}><Icon name="camera" size={13} /> 리뷰 작성</button>}
      <div className="place-actions">{showUnsaveAction && <button type="button" onClick={toggleSaved} className="ghost-button favorite-remove-button" disabled={updatingFavorite}><Icon name="heart" size={13} /> {updatingFavorite ? '찜 해제 중...' : '찜 해제'}</button>}{onCourseToggle && <button type="button" onClick={(event) => { event.stopPropagation(); onCourseToggle() }} className={inCourse ? 'ghost-button course-remove-button' : 'primary-button course-add-button'}>{inCourse ? <><Icon name="close" size={13} /> 코스에서 제거</> : <><Icon name="route" size={13} /> 코스에 추가</>}</button>}{onRemove && <button type="button" onClick={(event) => { event.stopPropagation(); onRemove(place.id) }} className="ghost-button"><Icon name="close" size={13} /> 장소 빼기</button>}<a href={place.placeUrl || `https://map.kakao.com/?q=${encodeURIComponent(place.name)}`} target="_blank" rel="noreferrer" className="ghost-button" onClick={(event) => event.stopPropagation()}>지도에서 보기 <Icon name="arrow" size={13} /></a></div>
    </div>
    {selectedReview && <div className="review-modal" role="dialog" aria-modal="true" aria-label="리뷰 전체 보기" onClick={() => setSelectedReview(null)}><article onClick={(event) => event.stopPropagation()}><header><h3>방문자 리뷰 {reviews.length}개</h3><button type="button" className="modal-close" aria-label="리뷰 닫기" onClick={() => setSelectedReview(null)}>×</button></header>{reviewError && <p className="inline-error review-modal-error">{reviewError}</p>}<div className="review-modal-list">{[selectedReview, ...reviews.filter((review) => review.id !== selectedReview.id)].map((review) => <section className="review-detail" key={review.id}><span className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span><p>{review.content}</p>{review.image_url && <img src={review.image_url} alt="첨부된 리뷰 사진" />}<small>{review.user_name || '익명'} · {new Date(review.created_at).toLocaleDateString('ko-KR')}</small>{review.user_id === user?.id && <button type="button" className="danger-text" disabled={Boolean(deletingReviewId)} onClick={() => void deleteReview(review.id)}>{deletingReviewId === review.id ? '삭제 중...' : '삭제'}</button>}</section>)}</div></article></div>}
  </article>
}
