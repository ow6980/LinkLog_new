import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: string
  email: string
  username?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, username?: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // 로컬 스토리지에서 로그인 상태 확인
    const storedUser = localStorage.getItem('currentUser')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const signup = async (email: string, password: string, username?: string): Promise<boolean> => {
    try {
      // 기존 사용자 확인
      const users = JSON.parse(localStorage.getItem('users') || '[]')
      const existingUser = users.find((u: any) => u.email === email)
      
      if (existingUser) {
        return false // 이미 존재하는 이메일
      }

      // 새 사용자 생성
      const newUser = {
        id: Date.now().toString(),
        email,
        password, // 실제로는 해시화해야 하지만, 지금은 간단하게
        username: username || email.split('@')[0], // username이 없으면 이메일 앞부분 사용
      }

      users.push(newUser)
      localStorage.setItem('users', JSON.stringify(users))

      // 자동 로그인
      const userInfo = { id: newUser.id, email: newUser.email, username: newUser.username }
      localStorage.setItem('currentUser', JSON.stringify(userInfo))
      setUser(userInfo)

      return true
    } catch (error) {
      console.error('Signup error:', error)
      return false
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const users = JSON.parse(localStorage.getItem('users') || '[]')
      const user = users.find(
        (u: any) => u.email === email && u.password === password
      )

      if (user) {
        const userInfo = { id: user.id, email: user.email, username: user.username }
        localStorage.setItem('currentUser', JSON.stringify(userInfo))
        setUser(userInfo)
        return true
      }

      return false
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('currentUser')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

