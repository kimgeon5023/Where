import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
import Friends from './pages/Friends'
import SharedTrip from './pages/SharedTrip'
import Trips from './pages/Trips'
import NotFound from './pages/NotFound'
import { AuthProvider } from './auth/AuthContext'
import { FavoritesProvider } from './favorites/FavoritesContext'
import { TripsProvider } from './trips/TripsContext'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <FavoritesProvider>
          <TripsProvider><BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/result" element={<Result />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/share/trips/:shareToken" element={<SharedTrip />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter></TripsProvider>
        </FavoritesProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
