import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  token?: string
}

export interface PasswordSignupInput {
  username: string
  password: string
  name: string
}

export interface PasswordLoginInput {
  username: string
  password: string
}

interface AuthContextValue {
  user: User | null
  isLoggedIn: boolean
  signIn: (provider: SocialProvider) => Promise<void>
  signUpWithPassword: (input: PasswordSignupInput) => Promise<void>
  logInWithPassword: (input: PasswordLoginInput) => Promise<void>
  signOut: () => void
  updateProfile: (patch: Pick<User, 'name' | 'profileImage'>) => Promise<void>
}

const STORAGE_KEY = 'where-to-go-auth-user'
const OAUTH_RETURN_KEY = 'where-oauth-return'
const GOOGLE_WEB_CLIENT_ID = '1099032379724-1cjpq7viestf9bmq6rd0shi2po2jtfl0.apps.googleusercontent.com'
interface LegacyGoogleSignInPlugin {
  signIn(options: { clientId: string }): Promise<{ idToken: string }>
  signOut(): Promise<void>
}

const LegacyGoogleSignIn = registerPlugin<LegacyGoogleSignInPlugin>('LegacyGoogleSignIn')

function nativeGoogleError(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'GOOGLE_STATUS_12501') return new Error('Google 로그인이 취소되었습니다.')
  if (code === 'GOOGLE_STATUS_4') return new Error('휴대폰에서 사용할 수 있는 Google 계정이 없습니다.')
  if (code === 'GOOGLE_STATUS_10') return new Error('Google 로그인 설정을 확인해 주세요.')
  return error instanceof Error ? error : new Error('Google 로그인에 실패했습니다.')
}

function oauthCallbackUser() {
  const parameters = new URLSearchParams(window.location.hash.slice(1))
  const encodedUser = parameters.get('oauth_user')
  const oauthToken = parameters.get('oauth_token')
  const oauthError = parameters.get('oauth_error')
  if (!encodedUser && !oauthError) return null

  const fallbackPath = `${window.location.pathname}${window.location.search}`
  let returnPath = fallbackPath
  let returnState: unknown = null
  try {
    const saved = sessionStorage.getItem(OAUTH_RETURN_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as { path?: string; state?: unknown }
      if (typeof parsed.path === 'string' && parsed.path.startsWith('/')) { returnPath = parsed.path; returnState = parsed.state ?? null }
      sessionStorage.removeItem(OAUTH_RETURN_KEY)
    }
  } catch { sessionStorage.removeItem(OAUTH_RETURN_KEY) }
  window.history.replaceState(returnState, '', returnPath)
  if (oauthError) {
    window.alert(oauthError)
    return null
  }

  try {
    const base64 = encodedUser!.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedUser!.length / 4) * 4, '=')
    const binary = atob(base64)
    const user = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)))) as User
    if (!user.id || user.provider !== 'google') throw new Error('INVALID_OAUTH_USER')
    if (!oauthToken) throw new Error('MISSING_OAUTH_TOKEN')
    const authenticatedUser = { ...user, token: oauthToken }
    saveUser(authenticatedUser)
    return authenticatedUser
  } catch {
    window.alert('로그인 정보를 확인하지 못했습니다.')
    return null
  }
}

function parseStoredUser(stored: string | null) {
  if (!stored) return null
  const user = JSON.parse(stored) as User
  return user.id && ['password', 'google'].includes(user.provider) ? user : null
}

function readStoredUser() {
  const callbackUser = oauthCallbackUser()
  if (callbackUser) return callbackUser
  try {
    return parseStoredUser(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function saveUser(user: User | null) {
  if (user) {
    const serializedUser = JSON.stringify(user)
    localStorage.setItem(STORAGE_KEY, serializedUser)
    void Preferences.set({ key: STORAGE_KEY, value: serializedUser })
  } else {
    localStorage.removeItem(STORAGE_KEY)
    void Preferences.remove({ key: STORAGE_KEY })
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialUser] = useState<User | null>(readStoredUser)
  const [user, setUser] = useState<User | null>(initialUser)
  const [isRestoringSession, setIsRestoringSession] = useState(!initialUser)

  useEffect(() => {
    let cancelled = false

    if (initialUser) {
      saveUser(initialUser)
      return () => { cancelled = true }
    }

    void Preferences.get({ key: STORAGE_KEY })
      .then(({ value }) => {
        if (cancelled) return
        try {
          const restoredUser = parseStoredUser(value)
          if (restoredUser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredUser))
            setUser(restoredUser)
          }
        } catch {
          void Preferences.remove({ key: STORAGE_KEY })
        }
      })
      .finally(() => {
        if (!cancelled) setIsRestoringSession(false)
      })

    return () => { cancelled = true }
  }, [initialUser])
  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoggedIn: Boolean(user),
    signIn: async (provider) => {
      if (!Capacitor.isNativePlatform()) {
        window.location.assign(apiUrl(`/api/auth/oauth/${provider}`))
        return
      }

      try {
        const result = await LegacyGoogleSignIn.signIn({ clientId: GOOGLE_WEB_CLIENT_ID })
        const response = await fetch(apiUrl('/api/auth/google/native'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: result.idToken }),
        })
        const body = await response.json() as { user?: User; token?: string; error?: string }
        if (!response.ok || !body.user || !body.token) throw new Error(body.error || 'Google 로그인에 실패했습니다.')
        const nextUser = { ...body.user, token: body.token }
        setUser(nextUser)
        saveUser(nextUser)
      } catch (error) {
        throw nativeGoogleError(error)
      }
    },
    signUpWithPassword: async ({ username, name, password }) => {
      const response = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, password }),
      })
      const body = await response.json() as { user?: User; token?: string; error?: string }
      if (!response.ok || !body.user) throw new Error(body.error || '회원가입을 처리하지 못했습니다.')
      const nextUser = { ...body.user, token: body.token }
      setUser(nextUser)
      saveUser(nextUser)
      },
    logInWithPassword: async ({ username, password }) => {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await response.json() as { user?: User; token?: string; error?: string }
      if (!response.ok || !body.user) throw new Error(body.error || '로그인에 실패했습니다.')
      const nextUser = { ...body.user, token: body.token }
      setUser(nextUser)
      saveUser(nextUser)
    },
    signOut: () => {
      setUser(null)
      saveUser(null)
      if (Capacitor.isNativePlatform()) void LegacyGoogleSignIn.signOut()
    },
    updateProfile: async (patch) => {
      if (!user) throw new Error('Please sign in before updating your profile.')
      const response = await fetch(apiUrl('/api/auth/me'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token || ''}` },
        body: JSON.stringify(patch),
      })
      const body = await response.json() as { user?: User; error?: string }
      if (!response.ok || !body.user) throw new Error(body.error || 'Unable to update profile.')
      const nextUser = { ...body.user, token: user.token }
      setUser(nextUser)
      saveUser(nextUser)
    },
  }), [user])

  if (isRestoringSession) return null

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
