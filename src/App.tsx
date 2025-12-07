import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import MainPage from './pages/MainPage'
import ConnectMapPage from './pages/ConnectMapPage'
import BookmarkPage from './pages/BookmarkPage'
import InsightPage from './pages/InsightPage'
import IdeaDetailPage from './pages/IdeaDetailPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/connect-map" element={<ConnectMapPage />} />
            <Route path="/bookmark" element={<BookmarkPage />} />
            <Route path="/insight" element={<InsightPage />} />
            <Route path="/idea/:id" element={<IdeaDetailPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  )
}

export default App
