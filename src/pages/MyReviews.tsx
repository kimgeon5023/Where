import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import Icon from '../components/Icon'
import { useAuth } from '../auth/AuthContext'
import { apiUrl } from '../lib/api'
import { readCachedReviews, removeCachedReview, writeCachedReviews, type CachedReview } from '../lib/reviewCache'

type Review = CachedReview

export default function MyReviews() {
  const { user } = useAuth()
  const [reviews, setReviews] = useState<Review[]>(() => user ? readCachedReviews(user.id) : [])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftRating, setDraftRating] = useState(5)

  useEffect(() => {
    if (!user?.token) return
    const userId = user.id
    const token = user.token
    let active = true
    let retryTimer: number | undefined
    let retryDelay = 2_000
    const cached = readCachedReviews(userId)
    if (cached.length) { setReviews(cached); setLoading(false) }
    const loadAllReviews = async () => {
      try {
        const all: Review[] = []
        for (let page = 1; ; page += 1) {
          const response = await fetch(apiUrl(`/api/my/reviews?page=${page}&limit=50`), { headers: { Authorization: `Bearer ${token}` } })
          const raw = await response.text()
          let body: { data?: Review[]; error?: string } = {}
          try { body = JSON.parse(raw) as { data?: Review[]; error?: string } } catch { /* Render wake responses can be HTML. */ }
          if (!response.ok) throw new Error(body.error || '리뷰를 불러오지 못했습니다.')
          const batch = body.data || []
          all.push(...batch)
          if (batch.length < 50) break
        }
        if (active) { setReviews(all); writeCachedReviews(userId, all); setMessage(''); retryDelay = 2_000 }
      } catch {
        if (active) {
          setMessage(cached.length || readCachedReviews(userId).length ? '리뷰 서버와 다시 연결 중이에요. 저장된 리뷰를 먼저 표시합니다.' : '리뷰 서버와 다시 연결 중이에요. 연결되면 작성한 리뷰가 자동으로 표시됩니다.')
          if (retryTimer) window.clearTimeout(retryTimer)
          retryTimer = window.setTimeout(() => { void loadAllReviews() }, retryDelay)
          retryDelay = Math.min(15_000, retryDelay * 2)
        }
      } finally { if (active) setLoading(false) }
    }
    const refreshOnReviewSave = () => { setReviews(readCachedReviews(userId)); void loadAllReviews() }
    window.addEventListener('where:review-saved', refreshOnReviewSave)
    window.addEventListener('focus', refreshOnReviewSave)
    void loadAllReviews()
    return () => { active = false; if (retryTimer) window.clearTimeout(retryTimer); window.removeEventListener('where:review-saved', refreshOnReviewSave); window.removeEventListener('focus', refreshOnReviewSave) }
  }, [user?.id, user?.token])

  if (!user) return <Navigate to="/" replace />

  const beginEdit = (review: Review) => { setEditingId(review.id); setDraftContent(review.content); setDraftRating(review.rating); setMessage('') }
  const cancelEdit = () => { setEditingId(null); setDraftContent(''); setDraftRating(5) }
  const saveEdit = async (review: Review) => {
    if (!draftContent.trim()) return setMessage('리뷰 내용을 입력해 주세요.')
    try {
      const response = await fetch(apiUrl(`/api/reviews/${review.id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ content: draftContent.trim(), rating: draftRating, imageUrl: review.image_url || '' }) })
      const body = await response.json() as { data?: Review; error?: string }
      if (!response.ok || !body.data) return setMessage(body.error || '리뷰를 수정하지 못했습니다.')
      const next = reviews.map((item) => item.id === review.id ? { ...item, ...body.data } : item)
      setReviews(next); writeCachedReviews(user.id, next); cancelEdit(); setMessage('')
    } catch { setMessage('리뷰 서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.') }
  }
  const removeReview = async (review: Review) => {
    if (!window.confirm('이 리뷰를 삭제할까요?')) return
    try {
      const response = await fetch(apiUrl(`/api/reviews/${review.id}`), { method: 'DELETE', headers: { Authorization: `Bearer ${user.token}` } })
      if (!response.ok) return setMessage('리뷰를 삭제하지 못했습니다.')
      setReviews((current) => current.filter((item) => item.id !== review.id))
      removeCachedReview(user.id, review.id)
      if (editingId === review.id) cancelEdit()
      setMessage('')
    } catch { setMessage('리뷰 서버와 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.') }
  }

  return <main className="app-shell settings-shell">
    <header className="topbar settings-topbar"><Link to="/" className="brand"><span className="brand-mark">가</span><span>가볼까<span className="brand-dot">.</span></span></Link><AuthActions /></header>
    <section className="settings-content my-reviews-content">
      <Link to="/" className="settings-back"><Icon name="arrow" size={15} /> 홈으로 돌아가기</Link>
      <div className="eyebrow">MY REVIEWS</div>
      <h1>내가 작성한<br /><em>리뷰</em></h1>
      <p className="settings-description">작성한 모든 리뷰와 첨부 사진을 확인하고, 필요할 때 수정하거나 삭제할 수 있어요.</p>
      {message && <p className="settings-message error">{message}</p>}
      <section className="settings-card my-reviews-card">
        <div className="settings-card-heading"><div><span className="step-label">REVIEWS</span><h2>작성한 리뷰 {reviews.length}개</h2></div></div>
        {loading ? <p className="review-empty">리뷰를 불러오는 중이에요.</p> : reviews.length === 0 ? <p className="review-empty">아직 작성한 리뷰가 없어요. 추천 장소에서 첫 리뷰를 남겨 보세요.</p> : <div className="my-review-list">{reviews.map((review) => {
          const isEditing = editingId === review.id
          return <article className={`my-review-item${isEditing ? ' is-editing' : ''}`} key={review.id}>
            <div className="my-review-meta"><strong>{review.place_name || '이전 등록 장소'}</strong><span>{new Date(review.created_at).toLocaleDateString('ko-KR')}</span></div>
            {isEditing ? <>
              <div className="star-picker">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} onClick={() => setDraftRating(star)}>{star <= draftRating ? '★' : '☆'}</button>)}</div>
              <textarea value={draftContent} maxLength={1000} rows={5} onChange={(event) => setDraftContent(event.target.value)} />
              <div className="my-review-actions"><button type="button" className="ghost-button" onClick={cancelEdit}>취소</button><button type="button" className="primary-button" onClick={() => void saveEdit(review)}>수정 완료</button></div>
            </> : <>
              <div className="review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
              <p>{review.content}</p>{review.image_url && <img src={review.image_url} alt={`${review.place_name || '리뷰'} 첨부 사진`} />}
              <div className="my-review-actions"><button type="button" className="ghost-button" onClick={() => beginEdit(review)}>수정</button><button type="button" className="danger-text" onClick={() => void removeReview(review)}>삭제</button></div>
            </>}
          </article>
        })}</div>}
      </section>
    </section>
    <BottomNav />
  </main>
}
