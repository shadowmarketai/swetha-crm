import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, Mic, BarChart3, Users, Bot } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')

  const { login, register, demoLogin } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (isRegister) {
        await register({ name, email, password })
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Try the demo login below.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoLogin = () => {
    demoLogin()
    navigate('/')
  }

  const features = [
    { icon: Mic, title: 'Voice AI Engine', desc: 'Tamil, Hindi dialect detection with emotion analysis' },
    { icon: BarChart3, title: 'Smart Analytics', desc: 'Real-time call analytics and lead scoring' },
    { icon: Users, title: 'CRM Integration', desc: 'Zoho, HubSpot, Salesforce auto-sync' },
    { icon: Bot, title: 'AI Assistants', desc: 'Custom voice bots for sales & support' },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-brand-400 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Zap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">VoiceFlow</h1>
              <p className="text-sm text-brand-300">Marketing AI</p>
            </div>
          </div>

          <h2 className="text-4xl font-display font-bold leading-tight mb-4">
            Voice Intelligence<br />for Indian SMBs
          </h2>
          <p className="text-lg text-brand-200 max-w-md">
            Transform customer calls into actionable insights with AI-powered voice analytics, CRM automation, and marketing intelligence.
          </p>
        </div>

        <div className="relative z-10 space-y-6">
          {features.map((f) => (
            <div key={f.title} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-5 h-5 text-brand-300" />
              </div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-brand-300">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-sm text-brand-400">
          Built by ShadowMarket
        </p>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-gray-900">VoiceFlow</h1>
              <p className="text-xs text-gray-500">Marketing AI</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-gray-900">
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-500 mt-2">
              {isRegister
                ? 'Start your 14-day free trial. No credit card required.'
                : 'Sign in to your VoiceFlow dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="Your full name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="you@company.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11 pr-11"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {!isRegister && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <button type="button" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {isRegister ? 'Creating account...' : 'Signing in...'}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isRegister ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 text-gray-500">or</span>
            </div>
          </div>

          {/* Demo login */}
          <button
            onClick={handleDemoLogin}
            className="btn btn-secondary w-full py-3"
          >
            <Zap className="w-4 h-4 text-brand-600" />
            Try Demo Dashboard
          </button>

          {/* Toggle register/login */}
          <p className="text-center mt-6 text-sm text-gray-500">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsRegister(!isRegister); setError('') }}
              className="text-brand-600 hover:text-brand-700 font-medium"
            >
              {isRegister ? 'Sign in' : 'Start free trial'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
