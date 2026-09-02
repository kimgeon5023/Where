import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthActions from '../components/AuthActions'
import BottomNav from '../components/BottomNav'
import { useAuth } from '../auth/AuthContext'
import { addFriend, getFriends, getNotifications, getSocialUsers, requestRelationship, respondNotification, type Notification, type RelationshipType, type SocialUser } from '../lib/social'

const relationLabel: Record<RelationshipType, string> = { friend: '친구', couple: '연인', family: '가족' }
const relationIcon: Record<RelationshipType, string> = { friend: '👥', couple: '♥', family: '🏠' }

export default function Friends() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<SocialUser[]>([])
  const [friends, setFriends] = useState<SocialUser[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!user) return
    try {
      if (!user.token) throw new Error('로그인이 만료되었습니다. 다시 로그인해주세요.')
      const [usersResult, friendsResult, notificationsResult] = await Promise.all([getSocialUsers(user.token), getFriends(user.token), getNotifications(user.token)])
      setUsers(usersResult.data); setFriends(friendsResult.data); setNotifications(notificationsResult.data)
    } catch (error) { setNotice(error instanceof Error ? error.message : '목록을 불러오지 못했어요.') }
  }, [user])
  useEffect(() => { void load() }, [load])
  if (!user) return <main className="app-shell settings-shell"><p className="saved-empty">친구 기능은 로그인 후 사용할 수 있어요.</p><Link to="/" className="back-button">메인으로</Link><BottomNav /></main>
  const add = async (friendId: string) => { try { await addFriend(user.token || '', friendId); setNotice('친구가 추가되었습니다.'); await load() } catch (error) { setNotice(error instanceof Error ? error.message : '친구 추가에 실패했어요.') } }
  const register = async (friendId: string, relationshipType: RelationshipType) => { try { await requestRelationship(user.token || '', friendId, relationshipType); setNotice(`${relationLabel[relationshipType]} 등록 요청을 보냈습니다.`); await load() } catch (error) { setNotice(error instanceof Error ? error.message : '등록 요청에 실패했어요.') } }
  const respond = async (notification: Notification, accepted: boolean) => { try { await respondNotification(user.token || '', notification.id, accepted); setNotice(accepted ? '등록 되었습니다.' : '거절 되었습니다.'); await load(); if (!accepted) navigate('/') } catch (error) { setNotice(error instanceof Error ? error.message : '응답 처리에 실패했어요.') } }
  const friendIds = new Set(friends.map((friend) => friend.id))
  return <main className="app-shell settings-shell"><header className="topbar"><Link to="/" className="brand"><span className="brand-mark">갈</span><span>갈래말래<span className="brand-dot">.</span></span></Link><AuthActions /></header><section className="friends-page"><div className="eyebrow">SOCIAL</div><h1>친구와 함께<br /><em>갈래말래?</em></h1>{notice && <p className="social-notice">{notice}</p>}<section className="social-section"><h2>알림</h2>{notifications.length === 0 ? <p>새 알림이 없어요.</p> : notifications.map((notification) => <article className="notification-card" key={notification.id}><div><strong>{notification.sender.name}님이 당신을 {relationLabel[notification.relationshipType]}으로 등록했습니다.</strong><span>{notification.status === 'pending' ? '관계를 선택해 응답해 주세요.' : notification.status === 'accepted' ? '등록 되었습니다.' : '거절 되었습니다.'}</span></div>{notification.status === 'pending' && <div className="notification-actions"><button onClick={() => void respond(notification, true)} type="button" className="primary-button">허용</button><button onClick={() => void respond(notification, false)} type="button" className="ghost-button">거절</button></div>}</article>)}</section><section className="social-section"><h2>친구 추가</h2><div className="friend-list">{users.filter((person) => !friendIds.has(person.id)).map((person) => <article className="friend-card" key={person.id}><span className="friend-avatar">{person.profileImage ? <img src={person.profileImage} alt="" /> : person.name.slice(0, 1)}</span><div><strong>{person.name}</strong><span>{person.email}</span></div><button type="button" className="ghost-button" onClick={() => void add(person.id)}>친구 추가</button></article>)}{users.filter((person) => !friendIds.has(person.id)).length === 0 && <p>추가할 사용자가 없어요.</p>}</div></section><section className="social-section"><h2>친구 목록</h2><div className="friend-list">{friends.map((friend) => <article className="friend-card" key={friend.id}><span className="friend-avatar">{friend.profileImage ? <img src={friend.profileImage} alt="" /> : friend.name.slice(0, 1)}</span><div><strong>{friend.name} <small className="relationship-icons">{friend.relationships?.map((relation) => <span key={relation} title={relationLabel[relation]}>{relationIcon[relation]}</span>)}</small></strong><span>{friend.email}</span></div><div className="relation-controls">{(['friend', 'couple', 'family'] as RelationshipType[]).map((relation) => <button key={relation} type="button" onClick={() => void register(friend.id, relation)}>{relationLabel[relation]} 등록</button>)}</div></article>)}{friends.length === 0 && <p>친구를 추가해 보세요.</p>}</div></section></section></main>
}
