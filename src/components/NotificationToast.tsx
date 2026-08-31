import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getNotifications, respondNotification, type Notification } from '../lib/social'

const POLL_MS = 15000
const SEEN_KEY = 'where-notification-seen'

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch { return new Set() }
}
function writeSeen(ids: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

export default function NotificationToast() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState<Notification[]>([])
  const seenRef = useRef<Set<string>>(readSeen())

  useEffect(() => {
    if (!user) { setPending([]); return }
    let cancelled = false
    const fetch = async () => {
      try {
        const res = await getNotifications(user.id)
        if (cancelled) return
        // only pending and not yet dismissed via seen (but keep pending until responded)
        const list = res.data.filter((n) => n.status === 'pending')
        setPending(list)
      } catch { /* ignore polling errors */ }
    }
    fetch()
    const id = window.setInterval(fetch, POLL_MS)
    const onFocus = () => fetch()
    window.addEventListener('focus', onFocus)
    return () => { cancelled = true; window.clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [user])

  const dismiss = (id: string) => {
    seenRef.current.add(id)
    writeSeen(seenRef.current)
    setPending((prev) => prev.filter((n) => n.id !== id))
  }

  const respond = async (n: Notification, accepted: boolean) => {
    if (!user) return
    try {
      await respondNotification(user.id, n.id, accepted)
      dismiss(n.id)
    } catch (e) {
      alert(e instanceof Error ? e.message : '응답 실패')
    }
  }

  if (!user || pending.length === 0) return null

  return (
    <div className="notification-toast-stack" aria-live="polite">
      {pending.slice(0, 3).map((n) => (
        <div key={n.id} className="notification-toast" role="alert">
          <div className="notification-toast-head">
            <span className="notification-toast-icon">💬</span>
            <strong>{n.sender.name}님이 {n.relationshipType === 'friend' ? '친구' : n.relationshipType === 'couple' ? '연인' : '가족'}으로 등록</strong>
            <button type="button" className="notification-toast-close" onClick={() => dismiss(n.id)} aria-label="닫기">×</button>
          </div>
          <p>오른쪽 밑 카톡처럼 알림이 왔어요. 응답해 주세요.</p>
          <div className="notification-toast-actions">
            <button type="button" className="primary-button" onClick={() => void respond(n, true)}>허용</button>
            <button type="button" className="ghost-button" onClick={() => void respond(n, false)}>거절</button>
            <button type="button" className="ghost-button" onClick={() => navigate('/friends')}>보러가기</button>
          </div>
        </div>
      ))}
    </div>
  )
}
