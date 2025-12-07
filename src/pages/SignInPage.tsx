import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './SignInPage.css'

const SignInPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.')
      setIsLoading(false)
      return
    }

    const success = await login(email, password)
    setIsLoading(false)

    if (success) {
      navigate('/')
    } else {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    }
  }

  const handleSignUp = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate('/signup')
  }

  return (
    <div className="signin-page">
      <div className="signin-container">
        <div className="signin-content">
          <div className="title-section">
            <h1 className="main-title">Welcome</h1>
            <p className="subtitle">please enter your details</p>
          </div>

          <form className="signin-form" onSubmit={handleSignIn}>
            <div className="input-group">
              <label className="input-label">your email</label>
              <input
                type="email"
                className="signin-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourid@example.com"
              />
            </div>

            <div className="input-group">
              <label className="input-label">your password</label>
              <input
                type="password"
                className="signin-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="error-message">{error}</div>
            )}
            <div className="button-group">
              <button
                type="button"
                className="signup-button"
                onClick={handleSignUp}
                disabled={isLoading}
              >
                SIGN UP
              </button>
              <button
                type="submit"
                className="signin-submit-button"
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

export default SignInPage

