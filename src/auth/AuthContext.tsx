import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiUrl } from '../lib/api'

export type SocialProvider = 'google' | 'kakao'
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
const demoUsers: Record<SocialProvider, User> = {
  google: { id: 'demo-google-user', name: '어디갈까 여행자', email: 'traveler@gmail.com', provider: 'google', profileImage: '', createdAt: new Date().toISOString() },
  kakao: { id: 'demo-kakao-user', name: '어디갈까 여행자', email: 'traveler@kakao.com', provider: 'kakao', profileImage: '', createdAt: new Date().toISOString() },
}

function readStoredUser() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const user = JSON.parse(stored) as User
    // 예전 mock 소셜 로그인 세션은 소셜 버튼을 비활성화하면서 함께 초기화합니다.
    if (user.provider === 'password') return user
    localStorage.removeItem(STORAGE_KEY)
    return null
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
    // TODO: 백엔드 연결 시 이 mock을 Google·카카오 OAuth 호출로 교체합니다.
    signIn: async (provider) => {
      const nextUser = { ...demoUsers[provider], createdAt: new Date().toISOString() }
      setUser(nextUser)
      saveUser(nextUser)
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
