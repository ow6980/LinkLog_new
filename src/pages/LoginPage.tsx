import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './LoginPage.css'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    // TODO: Implement actual sign in logic
    console.log('Sign in:', { email, password })
    
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.')
      setIsLoading(false)
      return
    }

    const result = await login(email, password)
    setIsLoading(false)

    if (result.success) {
      navigate('/')
    } else {
      setError(result.error || '로그인에 실패했습니다.')
    }
  }

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault()
    navigate('/signup')
  }

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="login-header-container">
          <Link to="/" className="login-header-logo">
            LINK:LOG
          </Link>
          <nav className="login-header-nav">
            <Link to="/" className="login-nav-link">
              MAIN
            </Link>
            <Link to="/connect-map" className="login-nav-link">
              CONNECT MAP
            </Link>
            <Link to="/bookmark" className="login-nav-link">
              BOOKMARK
            </Link>
            <Link to="/insight" className="login-nav-link">
              INSIGHT
            </Link>
          </nav>
          <div className="login-header-signin">
            <button className="login-signin-button">SIGN IN</button>
          </div>
        </div>
      </header>
      <div className="login-main-container">
        <div className="login-main-content">
          <div className="login-title-section">
            <h1 className="login-title">Welcome</h1>
            <p className="login-subtitle">please enter your details</p>
          </div>
          <form className="login-form" onSubmit={handleSignIn}>
            <div className="login-input-area">
              <div className="login-input-wrapper">
                <label className="login-input-label">your email</label>
                <input
                  type="email"
                  className="login-input"
                  placeholder="yourid@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="login-input-wrapper">
                <label className="login-input-label">your password</label>
                <input
                  type="password"
                  className="login-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            {error && <div className="error-message" style={{color: 'red', marginTop: '10px'}}>{error}</div>}
            <div className="login-buttons">
              <button
                type="button"
                className="login-button login-button-signup"
                onClick={handleSignUp}
                disabled={isLoading}
              >
                SIGN UP
              </button>
              <button
                type="submit"
                className="login-button login-button-signin"
                disabled={isLoading}
              >
                SIGN IN
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

