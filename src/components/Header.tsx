import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './Header.css'

const Header = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          LINK:LOG
        </Link>
        <nav className="header-nav">
          <Link
            to="/connect-map"
            className={`nav-link ${isActive('/connect-map') ? 'active' : ''}`}
          >
            CONNECT MAP
          </Link>
          <Link
            to="/bookmark"
            className={`nav-link ${isActive('/bookmark') ? 'active' : ''}`}
          >
            BOOKMARK
          </Link>
          <Link
            to="/insight"
            className={`nav-link ${isActive('/insight') ? 'active' : ''}`}
          >
            INSIGHT
          </Link>
        </nav>
        <div className="header-signin">
          {isAuthenticated ? (
            <div className="user-info">
              <span className="user-email">{user?.username || user?.email}</span>
              <button className="signin-button" onClick={handleLogout}>
                SIGN OUT
              </button>
            </div>
          ) : (
            <Link to="/signin" className="signin-button-link">
              <button className="signin-button">SIGN IN</button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header