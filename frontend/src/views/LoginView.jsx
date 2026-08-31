import { useState } from 'react'
import { signIn } from '../auth.js'
import { MOCK } from '../api.js'
import Icon from '../components/Icon.jsx'

/**
 * Login page. In real mode: sends credentials to POST /auth/login.
 * In mock mode: accepts any email (original behaviour preserved).
 *
 * The GroundTrack SVG animation is preserved exactly from the original design.
 */
function GroundTrack() {
  const PASS = 'M -40 320 C 160 130, 340 500, 540 260 S 920 70, 1160 320'
  return (
    <svg viewBox="0 0 1100 580" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="swath" x1="0" x2="1">
          <stop offset="0%"   stopColor="#0B7285" stopOpacity="0" />
          <stop offset="55%"  stopColor="#0B7285" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#0B7285" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="#C1CDDA" strokeWidth="1" opacity="0.65">
        {[...Array(10)].map((_, i) => <line key={`h${i}`} x1="0" y1={i * 64} x2="1100" y2={i * 64} />)}
        {[...Array(14)].map((_, i) => <line key={`v${i}`} x1={i * 85} y1="0" x2={i * 85} y2="580" />)}
      </g>
      <ellipse cx="550" cy="290" rx="440" ry="250" fill="none" stroke="#C1CDDA" strokeWidth="1.2" />
      <ellipse cx="550" cy="290" rx="235" ry="250" fill="none" stroke="#C1CDDA" strokeWidth="1.2" />
      <line x1="0" y1="290" x2="1100" y2="290" stroke="#C1CDDA" strokeWidth="1.2" />
      <path d={PASS} fill="none" stroke="url(#swath)" strokeWidth="56" strokeLinecap="round" />
      <path d={PASS} fill="none" stroke="#0B7285" strokeWidth="1.6" strokeDasharray="1300"
            className="animate-track" opacity="0.9" />
      <circle r="4.5" fill="#0B7285">
        <animateMotion dur="15s" repeatCount="indefinite" path={PASS} />
      </circle>
      <circle r="14" fill="none" stroke="#0B7285" strokeWidth="1" opacity="0.45">
        <animateMotion dur="15s" repeatCount="indefinite" path={PASS} />
      </circle>
      <g fontFamily="'IBM Plex Mono', monospace" fontSize="9" fill="#8496A8" letterSpacing="1.5">
        <text x="18" y="26">17°54′N</text>
        <text x="18" y="566">18°03′N</text>
        <text x="990" y="26">74°06′E</text>
        <text x="990" y="566">74°18′E</text>
      </g>
    </svg>
  )
}

export default function LoginView({ onSignIn }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [remember, setRemember] = useState(false)
  const [err,      setErr]      = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email.trim()) { setErr('Please enter your email address.'); return }
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return }
    if (!MOCK && password.length < 4) { setErr('Password must be at least 4 characters.'); return }

    setLoading(true)
    setErr('')

    const result = await signIn({ email: email.trim(), password })

    setLoading(false)

    if (!result.ok) {
      setErr(result.error || 'Sign-in failed. Please try again.')
      return
    }

    onSignIn(result.session)
  }

  const demoSignIn = async () => {
    setLoading(true)
    setErr('')
    const result = await signIn({ email: 'admin@quantara.in', password: 'satquery2024', name: 'Demo Analyst' })
    setLoading(false)
    if (!result.ok) {
      setErr(result.error || 'Demo sign-in failed.')
      return
    }
    onSignIn(result.session)
  }

  return (
    <div className="grid h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.15fr_1fr]">
      {/* ── Left hero panel ─────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden border-r border-rule bg-sheet lg:block">
        <GroundTrack />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-sheet via-sheet/92 to-transparent p-12">
          <span className="key key-primary">Smart India Hackathon · PS 26167</span>
          <h2 className="mt-4 max-w-lg font-display text-[34px] font-bold leading-[1.1] tracking-tightest text-ink">
            Ask a satellite image a question.
            <span className="block text-primary">Get an answer you can audit.</span>
          </h2>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink2">
            Qwen understands. Specialist tools calculate. Leaflet visualizes.
            The execution trace proves what happened.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {['VQA', 'Grounding', 'Indices', 'Fusion', 'Change detection'].map((f) => (
              <span key={f} className="key key-primary">{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────── */}
      <div className="flex items-center justify-center bg-paper px-6 py-10">
        <div className="w-full max-w-[360px]">
          {/* Logo */}
          <div className="mb-10">
            <img
              src="/satquery_logo.png"
              alt="SatQuery"
              className="w-44 sm:w-52 h-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.style.removeProperty('display')
              }}
            />
            {/* Fallback text mark */}
            <span style={{ display: 'none' }} className="font-display text-[28px] font-bold text-ink">
              SatQuery
            </span>
          </div>

          <div>
            <h1 className="font-display text-[28px] font-bold leading-tight tracking-tightest text-ink">
              Sign in
            </h1>
            <p className="mt-1.5 text-[13px] text-ink2">
              {MOCK
                ? 'Mock mode — any email will work'
                : 'Geospatial analysis workspace · Team QUANTARA'}
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="eyebrow">Email</label>
              <input
                id="email" type="email" autoComplete="username"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }}
                placeholder="admin@quantara.in"
                className="field mt-1.5" disabled={loading}
              />
            </div>

            {/* Password with show/hide toggle */}
            <div>
              <label htmlFor="pw" className="eyebrow">Password</label>
              <div className="relative mt-1.5">
                <input
                  id="pw" type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }}
                  placeholder="••••••••"
                  className="field pr-10" disabled={loading}
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink3 hover:text-ink transition-colors">
                  {showPw ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M1 1l22 22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <input id="remember" type="checkbox" checked={remember}
                     onChange={(e) => setRemember(e.target.checked)}
                     className="h-4 w-4 rounded border-rule accent-primary" />
              <label htmlFor="remember" className="cursor-pointer text-[12px] text-ink2">
                Remember me on this device
              </label>
            </div>

            {/* Error */}
            {err && (
              <div className="flex items-start gap-2 rounded-md border border-carmine/25 bg-carmine-soft px-3 py-2.5">
                <Icon name="info" size={14} className="mt-0.5 shrink-0 text-carmine" />
                <p className="text-[12px] text-carmine-deep">{err}</p>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-rule" />
            <span className="eyebrow">or</span>
            <span className="h-px flex-1 bg-rule" />
          </div>

          {/* Demo sign-in — uses the configured backend credentials */}
          <button onClick={demoSignIn} disabled={loading} className="btn w-full py-2.5">
            Continue as demo analyst
          </button>

          {/* Disclaimer */}
          <p className="mt-7 text-[11px] leading-relaxed text-ink3">
            {MOCK
              ? 'Mock mode active — sessions are stored locally. No network calls are made.'
              : 'Sessions are stored locally in this browser. Credentials are validated by the backend.'}
          </p>
        </div>
      </div>
    </div>
  )
}
