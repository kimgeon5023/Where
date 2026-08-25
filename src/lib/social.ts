import { apiUrl } from './api'

export type RelationshipType = 'friend' | 'couple' | 'family'
export interface SocialUser { id: string; name: string; email: string; profileImage: string; relationships?: RelationshipType[] }
export interface Notification { id: string; relationshipType: RelationshipType; status: 'pending' | 'accepted' | 'rejected'; sender: SocialUser }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { headers: { 'Content-Type': 'application/json' }, ...options })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || '요청을 처리하지 못했어요.')
  return body
}

export const getSocialUsers = (userId: string) => request<{ data: SocialUser[] }>(`/api/social/users?userId=${encodeURIComponent(userId)}`)
export const getFriends = (userId: string) => request<{ data: SocialUser[] }>(`/api/social/friends?userId=${encodeURIComponent(userId)}`)
export const getNotifications = (userId: string) => request<{ data: Notification[] }>(`/api/social/notifications?userId=${encodeURIComponent(userId)}`)
export const addFriend = (userId: string, friendId: string) => request('/api/social/friends', { method: 'POST', body: JSON.stringify({ userId, friendId }) })
export const requestRelationship = (userId: string, recipientId: string, relationshipType: RelationshipType) => request('/api/social/relationship-requests', { method: 'POST', body: JSON.stringify({ userId, recipientId, relationshipType }) })
export const respondNotification = (userId: string, requestId: string, accepted: boolean) => request(`/api/social/notifications/${requestId}/respond`, { method: 'POST', body: JSON.stringify({ userId, accepted }) })
