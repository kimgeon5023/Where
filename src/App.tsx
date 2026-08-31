import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
import Friends from './pages/Friends'
import NotFound from './pages/NotFound'
import { AuthProvider } from './auth/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import NotificationToast from './components/NotificationToast'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/result" element={<Result />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/saved" element={<Saved />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <NotificationToast />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
