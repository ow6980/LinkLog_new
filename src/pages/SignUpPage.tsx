import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import './SignUpPage.css'

const SignUpPage = () => {
  const navigate = useNavigate()
  const { signup } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError('모든 필드를 입력해주세요.')
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.')
      setIsLoading(false)
      return
    }

    const result = await signup(email, password, username)
    setIsLoading(false)

    if (result.success) {
      alert('회원가입 확인 메일이 발송되었습니다. 이메일을 확인해주세요.')
      navigate('/signin')
    } else {
      setError(result.error || '회원가입에 실패했습니다.')
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="signup-content">
          <div className="title-section">
            <h1 className="main-title">Create Account</h1>
            <p className="subtitle">please enter your details</p>
          </div>

          <form className="signup-form" onSubmit={handleSignUp}>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input
                type="text"
                className="signup-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
              />
            </div>

            <div className="input-group">
              <label className="input-label">your email</label>
              <input
                type="email"
                className="signup-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourid@example.com"
              />
            </div>

            <div className="input-group">
              <label className="input-label">your password</label>
              <input
                type="password"
                className="signup-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>

            {error && (
              <div className="error-message">{error}</div>
            )}

            <button
              type="submit"
              className="create-account-button"
              disabled={isLoading}
            >
              CREATE ACCOUNT
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default SignUpPage

