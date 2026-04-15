/**
 * Login — World-class redesign with 3D hero scene
 *
 * Layout:
 *   - Full-screen dark gradient background
 *   - Three.js scene rendered absolutely (animated blob + particles + camera parallax)
 *   - Glassmorphism login card centered (or split layout on desktop)
 *   - Frosted-glass form with premium typography & smooth focus states
 *
 * Tech: react-three-fiber + drei (already in deps), Tailwind, lucide-react.
 * No external CSS frameworks added — everything self-contained.
 */

import { Suspense, lazy, useState, useEffect, Component } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

// Inline ErrorBoundary for the 3D scene — prevents white page if WebGL crashes
class ErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? (this.props.fallback || null) : this.props.children }
}
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Shield, Zap, Globe2,
} from 'lucide-react'

// Lazy-load the 3D scene so the form paints first
const ThreeScene = lazy(() => import('../components/login/ThreeScene'))

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [mounted, setMounted] = useState(false)

  const { login, register, demoLogin } = useAuth()
  const navigate = useNavigate()

  // Trigger entrance animations after mount
  useEffect(() => { setMounted(true) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      let userData
      if (isRegister) {
        userData = await register({ name, email, password })
      } else {
        userData = await login(email, password)
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
    navigate('/crm')
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05050d]">
      {/* ── Background gradient + glow (single GPU-cheap layer) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 25% 0%, rgba(147, 51, 234, 0.25) 0%, transparent 50%), ' +
            'radial-gradient(ellipse at 75% 100%, rgba(219, 39, 119, 0.18) 0%, transparent 50%), ' +
            'radial-gradient(ellipse at 75% 33%, rgba(6, 182, 212, 0.10) 0%, transparent 50%), ' +
            'linear-gradient(135deg, #0a0a1f 0%, #1a0a2e 50%, #000428 100%)',
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── 3D Scene (lazy, fills entire background — skip if WebGL unavailable) ── */}
      <div className="absolute inset-0">
        <ErrorBoundary fallback={<div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />}>
          <Suspense fallback={null}>
            <ThreeScene />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Vignette to keep form legible over the 3D scene */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#05050d] via-transparent to-[#05050d]/80 pointer-events-none" />

      {/* ── Content layer ─────────────────────────────────────── */}
      <div className="relative z-10 min-h-screen grid lg:grid-cols-2 gap-0">
        {/* ─── LEFT: Brand + tagline ─────────────────────────── */}
        <div
          className={`hidden lg:flex flex-col justify-between p-12 xl:p-16 transition-all duration-1000 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
          }`}
        >
          {/* Top: brand mark */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-[1px]">
                <div className="w-full h-full rounded-2xl bg-[#0a0a1f] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute -inset-1 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur opacity-30" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Swetha CRM</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-purple-300/70">
                Swetha&nbsp;Structures
              </p>
            </div>
          </div>

          {/* Middle: hero copy */}
          <div className="space-y-8">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-xs text-purple-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                System operational · v2.4
              </span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] tracking-tight">
              <span className="bg-gradient-to-br from-white via-purple-100 to-purple-300 bg-clip-text text-transparent">
                PEB Works &
              </span>
              <br />
              <span className="bg-gradient-to-br from-amber-200 via-orange-300 to-yellow-400 bg-clip-text text-transparent">
                Smart CRM.
              </span>
            </h1>

            <p className="text-lg text-purple-200/70 max-w-md leading-relaxed">
              CRM, PEB quotation system, and business automation —
              built for Swetha Structures Pvt Ltd.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { icon: Shield, label: 'Multi-tenant SaaS' },
                { icon: Zap,    label: 'Voice AI' },
                { icon: Globe2, label: '4 Tamil dialects' },
              ].map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-xs text-white/70"
                >
                  <f.icon className="w-3 h-3" />
                  {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom: footer text */}
          <div className="text-xs text-white/30">
            Trusted by 200+ businesses · Made in Coimbatore
          </div>
        </div>

        {/* ─── RIGHT: Login card ─────────────────────────────── */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div
            className={`w-full max-w-md transition-all duration-1000 delay-200 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            {/* Mobile brand mark */}
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-[1px]">
                <div className="w-full h-full rounded-xl bg-[#0a0a1f] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-white font-bold text-lg">Swetha CRM</p>
            </div>

            {/* Glass card */}
            <div className="relative">
              {/* Animated border glow */}
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-cyan-500/40 opacity-60 blur-sm" />

              <div className="relative rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                {/* Header */}
                <div className="mb-7">
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    {isRegister ? 'Create account' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-white/50 mt-2">
                    {isRegister
                      ? 'Start your free trial — no credit card.'
                      : 'Sign in to continue to your workspace.'}
                  </p>
                </div>

                {/* Error */}
                {error && (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                    {error}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isRegister && (
                    <Field label="Full name">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        required
                        className="login-input"
                      />
                    </Field>
                  )}

                  <Field label="Email address" icon={Mail}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      className="login-input login-input-with-icon"
                    />
                  </Field>

                  <Field label="Password" icon={Lock}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete={isRegister ? 'new-password' : 'current-password'}
                      className="login-input login-input-with-icon pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-[34px] text-white/40 hover:text-white/80 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </Field>

                  {!isRegister && (
                    <div className="flex items-center justify-between text-xs">
                      <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500/40 focus:ring-offset-0"
                        />
                        Remember me
                      </label>
                      <button type="button" className="text-purple-300 hover:text-purple-200 font-medium">
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full mt-2 overflow-hidden rounded-xl"
                  >
                    {/* Animated gradient background */}
                    <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 transition-transform group-hover:scale-110" />
                    <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-60 blur-xl transition-opacity" />

                    <span className="relative flex items-center justify-center gap-2 px-6 py-3.5 text-white font-semibold text-sm">
                      {isLoading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {isRegister ? 'Creating account…' : 'Signing in…'}
                        </>
                      ) : (
                        <>
                          {isRegister ? 'Create account' : 'Sign in'}
                          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 text-[10px] uppercase tracking-widest bg-[#0c0a1f] text-white/40">
                      or
                    </span>
                  </div>
                </div>

                {/* Demo login */}
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Explore Demo
                </button>

                {/* Toggle */}
                <p className="text-center mt-6 text-xs text-white/50">
                  {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    onClick={() => { setIsRegister(!isRegister); setError('') }}
                    className="text-purple-300 hover:text-purple-200 font-medium"
                  >
                    {isRegister ? 'Sign in' : 'Start free trial'}
                  </button>
                </p>
              </div>
            </div>

            {/* Tiny footer under the card */}
            <p className="text-center mt-6 text-[10px] text-white/30">
              Protected by enterprise-grade encryption · &copy; 2026 Swetha CRM
            </p>
          </div>
        </div>
      </div>

      {/* ── Inline component-scoped styles ─────────────────────── */}
      <style>{`
        .login-input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: all 200ms ease;
        }
        .login-input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
        .login-input:hover {
          border-color: rgba(255, 255, 255, 0.16);
        }
        .login-input:focus {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(168, 85, 247, 0.5);
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.12);
        }
        .login-input-with-icon {
          padding-left: 40px;
        }
      `}</style>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────

function Field({ label, icon: Icon, children }) {
  return (
    <label className="block relative">
      <span className="block text-xs font-medium text-white/60 mb-1.5">{label}</span>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
        )}
        {children}
      </div>
    </label>
  )
}
