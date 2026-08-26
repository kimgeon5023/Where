import { Link } from 'react-router-dom'
import Icon from '../components/Icon'

export default function NotFound() {
  return (
    <main className="app-shell home-shell" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="login-mark" style={{ margin: '0 auto 24px' }}><span style={{ fontSize: 28 }}>?</span></div>
        <div className="eyebrow">PAGE NOT FOUND</div>
        <h1 style={{ margin: '14px 0 12px', fontSize: 48, letterSpacing: '-.08em', fontWeight: 800 }}>길을 잃었어요</h1>
        <p style={{ color: '#858a86', marginBottom: 32 }}>요청하신 페이지를 찾을 수 없어요.</p>
        <Link to="/" className="primary-button" style={{ display: 'inline-flex', width: 'auto', padding: '0 28px' }}>
          <Icon name="arrow" size={17} /> 홈으로 돌아가기
        </Link>
      </div>
    </main>
  )
}
