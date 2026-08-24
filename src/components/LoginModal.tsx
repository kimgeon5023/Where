import { useState } from 'react'
import Icon from './Icon'
import { useAuth, type SocialProvider } from '../auth/AuthContext'

interface LoginModalProps {
  open: boolean
  onClose: () => void
}

type ModalMode = 'social' | 'signup'

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { signUpWithPassword } = useAuth()
  const [mode, setMode] = useState<ModalMode>('social')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  const socialButton = (provider: SocialProvider) => (
    <button type="button" className={`social-button ${provider === 'google' ? 'google-button' : 'kakao-button'}`} disabled aria-disabled="true">
      <span className={`social-logo ${provider === 'google' ? 'google-logo' : 'kakao-logo'}`}>{provider === 'google' ? 'G' : '●'}</span>
      {provider === 'google' ? 'Google 로그인 준비 중' : '카카오 로그인 준비 중'}
    </button>
  )

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="로그인 창 닫기" onClick={onClose}><Icon name="close" size={18} /></button>
        <span className="login-mark">W</span>
        <span className="eyebrow">WELCOME TO WHERE TO GO</span>
        <h2 id="login-title">{mode === 'social' ? <>여행 취향을<br /><em>저장해볼까요?</em></> : <>어디갈까에<br /><em>가입해볼까요?</em></>}</h2>
        {mode === 'social' ? <>
          <p>현재 소셜 로그인은 준비 중이에요.<br />먼저 아이디로 회원가입할 수 있어요.</p>
          <div className="social-buttons">{socialButton('google')}{socialButton('kakao')}</div>
          <button type="button" className="signup-switch" onClick={() => changeMode('signup')}>아이디로 회원가입하기 <span>→</span></button>
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
        </>}
        {mode === 'social' && <small className="login-note">Google·카카오 로그인은 백엔드 연결 후 이용할 수 있어요.</small>}
      </section>
    </div>
  )
}
