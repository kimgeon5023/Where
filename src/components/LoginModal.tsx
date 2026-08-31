import { useState } from 'react'
import Icon from './Icon'
import { useAuth } from '../auth/AuthContext'

interface LoginModalProps {
  open: boolean
  onClose: () => void
}

type ModalMode = 'social' | 'signup' | 'login'

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { signIn, signUpWithPassword, logInWithPassword } = useAuth()
  const [mode, setMode] = useState<ModalMode>('social')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)

  // 로그인용 상태
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  if (!open) return null

  const changeMode = (nextMode: ModalMode) => {
    setMode(nextMode)
    setError('')
  }

  const submitSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedUsername = username.trim()
    if (trimmedName.length < 2) return setError('닉네임을 2자 이상 입력해 주세요.')
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(trimmedUsername)) return setError('아이디는 영문, 숫자, 밑줄 4~20자로 입력해 주세요.')
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password)) return setError('비밀번호는 영문과 숫자를 섞어 8자 이상 입력해 주세요.')
    if (password !== passwordConfirm) return setError('비밀번호가 서로 달라요.')

    setLoading(true)
    try {
      await signUpWithPassword({ name: trimmedName, username: trimmedUsername, password })
      onClose()
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : '회원가입을 처리하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedUsername = loginUsername.trim()
    if (!trimmedUsername) return setError('아이디를 입력해 주세요.')
    if (!loginPassword) return setError('비밀번호를 입력해 주세요.')

    setLoading(true)
    try {
      await logInWithPassword({ username: trimmedUsername, password: loginPassword })
      onClose()
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const startSocialLogin = async () => {
    setError('')
    setSocialLoading(true)
    try {
      await signIn('google')
    } catch {
      setSocialLoading(false)
      setError('소셜 로그인을 시작하지 못했습니다.')
    }
  }

  const googleButton = (
    <button type="button" className="social-button google-button" disabled={socialLoading} onClick={() => void startSocialLogin()}>
      <span className="social-logo google-logo">G</span>
      {socialLoading ? '로그인 화면으로 이동 중...' : 'Google 계정으로 로그인'}
    </button>
  )

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="로그인 창 닫기" onClick={onClose}><Icon name="close" size={18} /></button>
        <span className="login-mark">갈</span>
        <span className="eyebrow">WELCOME TO GALMAELLAE</span>
        <h2 id="login-title">{mode === 'social' ? <>여행 취향을<br /><em>저장해볼까요?</em></> : mode === 'login' ? <>기존 계정으로<br /><em>로그인해볼까요?</em></> : <>갈래말래에<br /><em>가입해볼까요?</em></>}</h2>
        {mode === 'social' ? <>
          <p>사용하는 계정으로<br />간편하게 로그인하세요.</p>
          {error && <p className="signup-error">{error}</p>}
          <div className="social-buttons">{googleButton}</div>
          <div style={{ marginTop: 14 }}>
            <button type="button" className="signup-switch" onClick={() => changeMode('login')}>아이디로 로그인하기 <span>→</span></button>
          </div>
          <div style={{ marginTop: 6 }}>
            <button type="button" className="signup-switch" onClick={() => changeMode('signup')}>아이디로 회원가입하기 <span>→</span></button>
          </div>
        </> : mode === 'login' ? <>
          <p>가입한 아이디와 비밀번호를<br />입력해 주세요.</p>
          <form className="signup-form" onSubmit={(event) => void submitLogin(event)}>
            <label><span>아이디</span><input value={loginUsername} onChange={(event) => setLoginUsername(event.target.value)} placeholder="영문·숫자·밑줄 4~20자" maxLength={20} autoComplete="username" /></label>
            <label><span>비밀번호</span><input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="비밀번호 입력" autoComplete="current-password" /></label>
            {error && <p className="signup-error">{error}</p>}
            <button type="submit" className="primary-button signup-submit" disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
          </form>
          <button type="button" className="signup-switch back-to-social" onClick={() => changeMode('social')}>← 소셜 로그인 화면으로</button>
          <button type="button" className="signup-switch" onClick={() => changeMode('signup')}>계정이 없으신가요? 회원가입 <span>→</span></button>
        </> : <>
          <p>아이디와 비밀번호를 입력해<br />나만의 여행 프로필을 만들어 보세요.</p>
          <form className="signup-form" onSubmit={(event) => void submitSignup(event)}>
            <label><span>닉네임</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="여행자 이름" maxLength={20} /></label>
            <label><span>아이디</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="영문·숫자·밑줄 4~20자" maxLength={20} autoComplete="username" /></label>
            <label><span>비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="영문 + 숫자, 8자 이상" autoComplete="new-password" /></label>
            <label><span>비밀번호 확인</span><input type="password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="비밀번호를 다시 입력" autoComplete="new-password" /></label>
            {error && <p className="signup-error">{error}</p>}
            <button type="submit" className="primary-button signup-submit" disabled={loading}>{loading ? '가입 중...' : '회원가입 완료'}</button>
          </form>
          <button type="button" className="signup-switch back-to-social" onClick={() => changeMode('social')}>← 소셜 로그인 화면으로</button>
          <div style={{ marginTop: 8 }}>
            <button type="button" className="signup-switch" onClick={() => changeMode('login')}>이미 계정이 있으신가요? 로그인 <span>→</span></button>
          </div>
        </>}
        {mode === 'social' && <small className="login-note">계정 정보는 Google 동의 화면을 통해서만 전달됩니다.</small>}
      </section>
    </div>
  )
}
