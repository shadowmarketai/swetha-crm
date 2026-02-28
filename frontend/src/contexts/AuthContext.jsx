import { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('voiceflow_token')
    if (token) {
      authAPI.getProfile()
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('voiceflow_token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password })
    const { token, user: userData } = res.data
    localStorage.setItem('voiceflow_token', token)
    setUser(userData)
    return userData
  }

  const register = async (data) => {
    const res = await authAPI.register(data)
    const { token, user: userData } = res.data
    localStorage.setItem('voiceflow_token', token)
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('voiceflow_token')
    setUser(null)
  }

  // Demo login - bypasses API for development
  const demoLogin = () => {
    const demoUser = {
      id: 'demo-001',
      name: 'VoiceFlow Admin',
      email: 'admin@voiceflow.ai',
      role: 'admin',
      company: 'ShadowMarket',
      plan: 'pro',
    }
    localStorage.setItem('voiceflow_token', 'demo-token-123')
    setUser(demoUser)
    return demoUser
  }

  // Demo login as a specific role - for testing RBAC
  const demoLoginAs = (role) => {
    const roleNames = {
      admin: 'VoiceFlow Admin',
      manager: 'VoiceFlow Manager',
      agent: 'VoiceFlow Agent',
      user: 'VoiceFlow User',
      viewer: 'VoiceFlow Viewer',
    }
    const demoUser = {
      id: `demo-${role}-001`,
      name: roleNames[role] || 'VoiceFlow User',
      email: `${role}@voiceflow.ai`,
      role: role,
      company: 'ShadowMarket',
      plan: role === 'admin' ? 'pro' : 'starter',
    }
    localStorage.setItem('voiceflow_token', 'demo-token-123')
    setUser(demoUser)
    return demoUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, demoLogin, demoLoginAs }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
