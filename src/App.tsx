import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
import Friends from './pages/Friends'
import NotFound from './pages/NotFound'
import { AuthProvider } from './auth/AuthContext'
import { FavoritesProvider } from './favorites/FavoritesContext'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <FavoritesProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/result" element={<Result />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </FavoritesProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
