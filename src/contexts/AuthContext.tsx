import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../supabaseClient'

interface User {
  id: string
  email: string
  username?: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, username?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 현재 세션 확인
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            username: session.user.user_metadata.username || session.user.email!.split('@')[0],
          })
        }
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error getting session:', error)
        setLoading(false) // 에러가 발생해도 로딩을 false로 설정
      })

    // 인증 상태 변경 리스너
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            username: session.user.user_metadata.username || session.user.email!.split('@')[0],
          })
        } else {
          setUser(null)
        }
        setLoading(false)
      })

      return () => subscription.unsubscribe()
    } catch (error) {
      console.error('Error setting up auth listener:', error)
      setLoading(false) // 에러가 발생해도 로딩을 false로 설정
    }
  }, [])

  const signup = async (email: string, password: string, username?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return { 
          success: false, 
          error: 'Supabase가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 추가해주세요.' 
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || email.split('@')[0],
          },
        },
      })

      if (error) throw error

      return { success: true }
    } catch (error: any) {
      console.error('Signup error:', error)
      
      // 네트워크 오류 처리
      if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        return { 
          success: false, 
          error: '서버에 연결할 수 없습니다. Supabase 설정을 확인해주세요.' 
        }
      }
      
      return { 
        success: false, 
        error: error.message || '회원가입 중 오류가 발생했습니다.' 
      }
    }
  }

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return { 
          success: false, 
          error: 'Supabase가 설정되지 않았습니다. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 추가해주세요.' 
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { success: true }
    } catch (error: any) {
      console.error('Login error:', error)
      
      // 네트워크 오류 처리
      if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
        return { 
          success: false, 
          error: '서버에 연결할 수 없습니다. Supabase 설정을 확인해주세요.' 
        }
      }
      
      return { 
        success: false, 
        error: error.message || '로그인 중 오류가 발생했습니다.' 
      }
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
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
      {!loading && children}
    </AuthContext.Provider>
  )
}

