import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import LoginModal from './LoginModal'
import { useAuth } from '../auth/AuthContext'

function Avatar({ name, image, size = 'small' }: { name: string; image: string; size?: 'small' | 'large' }) {
  return image
    ? <img className={`avatar avatar-${size}`} src={image} alt={`${name} 프로필`} />
    : <span className={`avatar avatar-${size} avatar-fallback`} aria-label={`${name} 프로필`}>{name.slice(0, 1)}</span>
}

export default function AuthActions() {
  const { user, signOut } = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  if (!user) {
    return <><button type="button" className="login-trigger" onClick={() => setLoginOpen(true)}><Icon name="person" size={15} /> 로그인</button><LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} /></>
  }

  return (
    <div className="auth-actions" ref={menuRef}>
      <button type="button" className="profile-trigger" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
        <Avatar name={user.name} image={user.profileImage} />
        <span>{user.name}</span>
        <span className="profile-chevron">⌄</span>
      </button>
      {menuOpen && <div className="profile-menu">
        <div className="profile-menu-head"><Avatar name={user.name} image={user.profileImage} size="large" /><div><strong>{user.name}</strong><span>{user.email}</span></div></div>
        <div className="profile-menu-divider" />
        <Link to="/friends" className="profile-menu-item" onClick={() => setMenuOpen(false)}>👥 친구 · 알림</Link>
        <Link to="/settings" className="profile-menu-item" onClick={() => setMenuOpen(false)}><Icon name="settings" size={16} /> 설정</Link>
        <button type="button" className="profile-menu-item logout-item" onClick={() => { signOut(); setMenuOpen(false) }}><Icon name="logout" size={16} /> 로그아웃</button>
        <button type="button" className="profile-menu-exit" onClick={() => setMenuOpen(false)}>나가기</button>
      </div>}
    </div>
  )
}
