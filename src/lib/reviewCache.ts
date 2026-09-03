export interface CachedReview {
  id: string
  place_id: string
  place_name?: string
  rating: number
  content: string
  image_url?: string
  created_at: string
}

const keyFor = (userId: string) => `where-my-reviews:${userId}`

export function readCachedReviews(userId: string): CachedReview[] {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(userId)) || '[]') as CachedReview[]
    return Array.isArray(value) ? value.filter((review) => review?.id) : []
  } catch { return [] }
}

export function writeCachedReviews(userId: string, reviews: CachedReview[]) {
  try { localStorage.setItem(keyFor(userId), JSON.stringify(reviews.slice(0, 200))) } catch { /* Storage is optional. */ }
}

export function rememberCachedReview(userId: string, review: CachedReview) {
  writeCachedReviews(userId, [review, ...readCachedReviews(userId).filter((item) => item.id !== review.id)])
}

export function removeCachedReview(userId: string, reviewId: string) {
  writeCachedReviews(userId, readCachedReviews(userId).filter((review) => review.id !== reviewId))
}
