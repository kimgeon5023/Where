import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiUrl } from '../lib/api'

export type SocialProvider = 'google'
export type AccountProvider = SocialProvider | 'password'

export interface User {
  id: string
  name: string
  email: string
  provider: AccountProvider
  profileImage: string
  sourceSite?: string
  createdAt: string
}

export interface PasswordSignupInput {
  username: string
  password: string
  name: string
}

interface AuthContextValue {
  user: User | null
  isLoggedIn: boolean
  signIn: (provider: SocialProvider) => Promise<void>
  signUpWithPassword: (input: PasswordSignupInput) => Promise<void>
  signOut: () => void
  updateProfile: (patch: Pick<User, 'name' | 'profileImage'>) => void
}

const STORAGE_KEY = 'where-to-go-auth-user'

function oauthCallbackUser() {
  const parameters = new URLSearchParams(window.location.hash.slice(1))
  const encodedUser = parameters.get('oauth_user')
  const oauthError = parameters.get('oauth_error')
  if (!encodedUser && !oauthError) return null

  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  if (oauthError) {
    window.alert(oauthError)
    return null
  }

  try {
    const base64 = encodedUser!.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedUser!.length / 4) * 4, '=')
    const binary = atob(base64)
    const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as User
    if (!user.id || user.provider !== 'google') throw new Error('INVALID_OAUTH_USER')
    saveUser(user)
    return user
  } catch {
    window.alert('로그인 정보를 확인하지 못했습니다.')
    return null
  }
}

function readStoredUser() {
  const callbackUser = oauthCallbackUser()
  if (callbackUser) return callbackUser
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const user = JSON.parse(stored) as User
    return user.id && ['password', 'google'].includes(user.provider) ? user : null
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  else localStorage.removeItem(STORAGE_KEY)
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readStoredUser)

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoggedIn: Boolean(user),
    signIn: async (provider) => {
      window.location.assign(apiUrl(`/api/auth/oauth/${provider}`))
    },
    signUpWithPassword: async ({ username, name, password }) => {
      const response = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password }),
      })
      const body = await response.json() as { user?: User; error?: string }
      if (!response.ok || !body.user) throw new Error(body.error || '회원가입을 처리하지 못했습니다.')
      const nextUser = body.user
      setUser(nextUser)
      saveUser(nextUser)
    },
    signOut: () => {
      setUser(null)
      saveUser(null)
    },
    updateProfile: (patch) => {
      setUser((current) => {
        if (!current) return current
        const nextUser = { ...current, ...patch }
        saveUser(nextUser)
        return nextUser
      })
    },
  }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
