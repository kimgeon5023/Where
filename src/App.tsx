import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Result from './pages/Result'
import Settings from './pages/Settings'
import Saved from './pages/Saved'
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
