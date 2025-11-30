import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MainPage from './pages/MainPage'
import ConnectMapPage from './pages/ConnectMapPage'
import BookmarkPage from './pages/BookmarkPage'
import InsightPage from './pages/InsightPage'
import IdeaDetailPage from './pages/IdeaDetailPage'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/connect-map" element={<ConnectMapPage />} />
          <Route path="/bookmark" element={<BookmarkPage />} />
          <Route path="/insight" element={<InsightPage />} />
          <Route path="/idea/:id" element={<IdeaDetailPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
