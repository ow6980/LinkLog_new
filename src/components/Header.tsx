import { Link, useLocation } from 'react-router-dom'
import './Header.css'

const Header = () => {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="header-logo">
          LINK:LOG
        </Link>
        <nav className="header-nav">
          <Link
            to="/"
            className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}
          >
            MAIN
          </Link>
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
          <button className="signin-button">SIGN IN</button>
        </div>
      </div>
    </header>
  )
}

export default Header