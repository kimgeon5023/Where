import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell home-shell" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div>
            <div className="login-mark" style={{ margin: '0 auto 24px' }}><span style={{ fontSize: 28 }}>!</span></div>
            <div className="eyebrow">ERROR</div>
            <h1 style={{ margin: '14px 0 12px', fontSize: 42, letterSpacing: '-.08em', fontWeight: 800 }}>문제가 발생했어요</h1>
            <p style={{ color: '#858a86', marginBottom: 32 }}>일시적인 오류입니다. 페이지를 새로고침해 주세요.</p>
            <button type="button" className="primary-button" style={{ display: 'inline-flex', width: 'auto', padding: '0 28px' }} onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}>
              홈으로 돌아가기
            </button>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}
