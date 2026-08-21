import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Icon from '../components/Icon'
import AuthActions from '../components/AuthActions'
import { useAuth } from '../auth/AuthContext'

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [preview, setPreview] = useState(user?.profileImage ?? '')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!user) return <Navigate to="/" replace />

  const handleFileChange = (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setMessage('JPG 또는 PNG 파일만 사용할 수 있어요.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('프로필 사진은 5MB 이하로 선택해 주세요.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setPreview(String(reader.result))
      setMessage('')
    }
    reader.readAsDataURL(file)
  }

  const save = () => {
    updateProfile({ name: name.trim() || '어디갈까 여행자', profileImage: preview })
    setMessage('프로필을 저장했어요.')
  }

  return (
    <main className="app-shell settings-shell">
      <header className="topbar settings-topbar">
        <Link to="/" className="brand"><span className="brand-mark">W</span><span>어디갈까<span className="brand-dot">.</span></span></Link>
        <AuthActions />
      </header>
      <section className="settings-content">
        <Link to="/" className="settings-back"><Icon name="arrow" size={15} /> 홈으로 돌아가기</Link>
        <div className="eyebrow">ACCOUNT SETTINGS</div>
        <h1>내 프로필을<br /><em>꾸며볼까요?</em></h1>
        <p className="settings-description">여행 추천에 사용할 나만의 프로필 정보를 관리해요.</p>
        <section className="settings-card">
          <div className="settings-card-heading"><div><span className="step-label">PROFILE</span><h2>프로필 정보</h2></div><span className="provider-badge">{user.provider === 'google' ? 'Google 연동' : user.provider === 'kakao' ? '카카오 연동' : '아이디 가입'}</span></div>
          <div className="profile-editor">
            <div className="profile-upload">
              {preview ? <img className="avatar avatar-xl" src={preview} alt="프로필 미리보기" /> : <span className="avatar avatar-xl avatar-fallback">{user.name.slice(0, 1)}</span>}
              <button type="button" className="camera-button" aria-label="프로필 사진 선택" onClick={() => fileInputRef.current?.click()}><Icon name="camera" size={16} /></button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => handleFileChange(event.target.files?.[0])} />
            </div>
            <div className="upload-copy"><strong>프로필 사진</strong><span>JPG, PNG · 최대 5MB</span><button type="button" className="outline-button" onClick={() => fileInputRef.current?.click()}>사진 바꾸기</button></div>
          </div>
          <label className="settings-field"><span>이름</span><input value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="이름을 입력해 주세요" /></label>
          {message && <p className={`settings-message ${message.includes('저장') ? 'success' : 'error'}`}>{message}</p>}
          <button type="button" className="primary-button settings-save" onClick={save}><Icon name="check" size={17} /> 변경사항 저장</button>
        </section>
      </section>
    </main>
  )
}
