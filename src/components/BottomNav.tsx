import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'

const tabs = [
  { to: '/', icon: 'pin' as const, label: '홈' },
  { to: '/saved', icon: 'heart' as const, label: '저장' },
  { to: '/trips', icon: 'route' as const, label: '코스' },
  { to: '/friends', icon: 'friends' as const, label: '친구' },
  { to: '/settings', icon: 'settings' as const, label: '설정' },
]

export default function BottomNav() {
  const location = useLocation()
  return (
    <nav className="bottom-nav" aria-label="모바일 내비게이션">
      {tabs.map((tab) => {
        const active = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
        return (
          <Link key={tab.to} to={tab.to} className={'bottom-nav-item' + (active ? ' active' : '')}>
            <Icon name={tab.icon} size={20} />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
