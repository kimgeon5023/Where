import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
import Friends from './pages/Friends'
import { AuthProvider } from './auth/AuthContext'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/result" element={<Result />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/friends" element={<Friends />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
