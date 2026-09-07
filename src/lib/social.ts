import { apiUrl } from './api'

export type RelationshipType = 'friend' | 'couple' | 'family'
export interface SocialUser { id: string; name: string; email?: string; profileImage: string; relationships?: RelationshipType[] }
export interface Notification { id: string; relationshipType: RelationshipType; status: 'pending' | 'accepted' | 'rejected'; sender: SocialUser }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { headers: { 'Content-Type': 'application/json' }, ...options })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error || '요청을 처리하지 못했어요.')
  return body
}

const authorization = (token: string) => ({ Authorization: `Bearer ${token}` })
export const getSocialUsers = (token: string) => request<{ data: SocialUser[] }>('/api/social/users', { headers: authorization(token) })
export const getFriends = (token: string) => request<{ data: SocialUser[] }>('/api/social/friends', { headers: authorization(token) })
export const getNotifications = (token: string) => request<{ data: Notification[] }>('/api/social/notifications', { headers: { Authorization: `Bearer ${token}` } })
export const addFriend = (token: string, friendId: string) => request('/api/social/friends', { method: 'POST', headers: authorization(token), body: JSON.stringify({ friendId }) })
export const requestRelationship = (token: string, recipientId: string, relationshipType: RelationshipType) => request('/api/social/relationship-requests', { method: 'POST', headers: authorization(token), body: JSON.stringify({ recipientId, relationshipType }) })
export const respondNotification = (token: string, requestId: string, accepted: boolean) => request(`/api/social/notifications/${requestId}/respond`, { method: 'POST', headers: authorization(token), body: JSON.stringify({ accepted }) })
