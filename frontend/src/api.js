/**
 * Single seam between the frontend and the FastAPI backend.
 * Contract 4 of the build spec. Every network call in the app goes through here.
 *
 * VITE_MOCK=1 replays a scripted session so the UI can be built and rehearsed
 * before the backend exists. Flip to 0 and the same functions hit the real API.
 */
import { mockUpload, mockQueryStream } from './mockData.js'

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const MOCK = import.meta.env.VITE_MOCK === '1' || !BASE

/** ngrok's free tier interstitial breaks fetch without this header. */
const NGROK_HEADER = { 'ngrok-skip-browser-warning': 'true' }

/** Attach the auth bearer token if one is present in localStorage. */
function _authHeader() {
  try {
    const token = localStorage.getItem('satquery.token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch { return {} }
}

/** Shared request headers for JSON endpoints. */
function _headers(extra = {}) {
  return { ...NGROK_HEADER, ..._authHeader(), ...extra }
}

/** Handle 401 globally — clear session and reload so the login page appears. */
function _handle401(res) {
  if (res.status === 401) {
    try {
      localStorage.removeItem('satquery.token')
      localStorage.removeItem('satquery.session')
    } catch { /* ignore */ }
    window.location.reload()
  }
}

// ── Health ────────────────────────────────────────────────────────────────

export async function health() {
  if (MOCK) return { status: 'mock', model_loaded: true }
  const r = await fetch(`${BASE}/health`, { headers: _headers() })
  if (!r.ok) throw new Error(`health ${r.status}`)
  return r.json()
}

// ── Upload ────────────────────────────────────────────────────────────────

/**
 * POST /upload  →  { scene_ids, metadata, validation }
 * pair_type: "single" | "bitemporal" | "cross_modal"
 */
export async function upload(files, pairType) {
  if (MOCK) return mockUpload(files, pairType)
  const body = new FormData()
  files.forEach((f) => body.append('files', f))
  body.append('pair_type', pairType)
  const r = await fetch(`${BASE}/upload`, {
    method: 'POST',
    body,
    headers: _headers(),   // no Content-Type — browser sets multipart boundary
  })
  _handle401(r)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ── Query (SSE stream) ────────────────────────────────────────────────────

/**
 * POST /query → Server-Sent Events.
 * Emits {event, data} objects to onEvent as they arrive. Returns an abort handle.
 */
export function query({ sceneIds, text, onEvent, onError, onDone }) {
  if (MOCK) return mockQueryStream({ sceneIds, text, onEvent, onDone })

  const ctrl = new AbortController()
  ;(async () => {
    try {
      const r = await fetch(`${BASE}/query`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ..._headers() },
        body:    JSON.stringify({ scene_ids: sceneIds, text }),
        signal:  ctrl.signal,
      })
      _handle401(r)
      if (!r.ok || !r.body) throw new Error(`query ${r.status}`)

      const reader = r.body.getReader()
      const dec    = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        // SSE frames are separated by a blank line.
        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.split('\n').find((l) => l.startsWith('data:'))
          if (!line) continue
          try { onEvent(JSON.parse(line.slice(5).trim())) }
          catch { /* malformed frame — skip */ }
        }
      }
      onDone?.()
    } catch (e) {
      if (e.name !== 'AbortError') onError?.(e)
    }
  })()

  return () => ctrl.abort()
}

// ── Report ────────────────────────────────────────────────────────────────

export function reportUrl(sessionId) {
  return MOCK ? '#' : `${BASE}/report/${sessionId}`
}

// ── Session history ───────────────────────────────────────────────────────

/**
 * GET /session/{session_id}/history
 * Returns the list of query traces stored in the backend for this session.
 * Falls back gracefully (empty array) if the backend is unavailable.
 */
export async function fetchHistory(sessionId) {
  if (MOCK || !sessionId) return []
  try {
    const r = await fetch(`${BASE}/session/${sessionId}/history`, {
      headers: _headers(),
    })
    _handle401(r)
    if (!r.ok) return []
    return r.json()
  } catch {
    return []
  }
}

// ── Demo scene pre-load ───────────────────────────────────────────────────

/**
 * The backend auto-loads demo scenes at startup when SATQUERY_DEMO_SCENES is set.
 * The frontend can ask for the scene metadata by uploading with an empty files
 * list and the pair_type name — the backend's upload endpoint handles empty files
 * for demo sessions by returning scenes already in memory.
 *
 * Since the backend auto-loads them in its own session space, we still need
 * to trigger the frontend's upload flow to get the metadata back. The demo-load
 * approach below sends empty files with the pair_type key, which triggers
 * mockUpload in mock mode and the real upload endpoint in live mode.
 */
export async function loadDemoSet(pairType) {
  return upload([], pairType)
}
