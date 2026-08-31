/**
 * Authentication — backed by POST /auth/login.
 *
 * Token storage: localStorage under 'satquery.token'.
 * Session storage: localStorage under 'satquery.session' (user profile).
 *
 * The mock flag is respected: in mock mode the original localStorage-only
 * behaviour is preserved so the app works without a backend.
 */
import { MOCK } from './api.js'

const TOKEN_KEY   = 'satquery.token'
const SESSION_KEY = 'satquery.session'

// ── Getters ──────────────────────────────────────────────────────────────

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null } catch { return null }
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') } catch { return null }
}

// ── Sign-in ───────────────────────────────────────────────────────────────

/**
 * In real mode: POSTs credentials to the backend, stores the token and user.
 * In mock mode: creates a local session as before (accepts any email).
 *
 * Returns: { ok: true, session } on success
 *          { ok: false, error: string } on failure
 */
export async function signIn({ email, password, name }) {
  if (MOCK) {
    // Legacy mock behaviour — accept any credentials, no backend call.
    const session = _makeLocalSession(email, name)
    _persist(null, session)
    return { ok: true, session }
  }

  const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim(), password }),
    })

    if (res.status === 401) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, error: body.detail || 'Invalid email or password.' }
    }
    if (!res.ok) {
      return { ok: false, error: `Server error ${res.status} — try again.` }
    }

    const { token, user } = await res.json()
    const session = {
      email:      user.email,
      name:       user.name,
      org:        user.org,
      role:       user.role,
      session_id: `sq-${Math.random().toString(36).slice(2, 10)}`,
      started:    new Date().toISOString(),
    }
    _persist(token, session)
    return { ok: true, session }
  } catch (err) {
    return { ok: false, error: `Could not reach the backend — ${err.message}. Check VITE_API_URL.` }
  }
}

// ── Sign-out ──────────────────────────────────────────────────────────────

export function signOut() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _persist(token, session) {
  try {
    if (token)  localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch { /* private/incognito — gracefully skip */ }
}

function _makeLocalSession(email, name) {
  return {
    email,
    name:       name || email.split('@')[0],
    org:        'Team QUANTARA',
    role:       'Analyst',
    session_id: `sq-${Math.random().toString(36).slice(2, 10)}`,
    started:    new Date().toISOString(),
  }
}
