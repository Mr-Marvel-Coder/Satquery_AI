import { useCallback, useEffect, useRef, useState } from 'react'
import { health, upload, MOCK, reportUrl } from './api.js'
import { getSession, getToken, signOut } from './auth.js'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import LoginView from './views/LoginView.jsx'
import IntroScreen from './views/IntroScreen.jsx'
import DashboardView from './views/DashboardView.jsx'
import AnalystView from './views/AnalystView.jsx'
import OrbView from './views/OrbView.jsx'
import ProfileView from './views/ProfileView.jsx'

/**
 * Shell. Three phases: 'login' → 'intro' → 'app'.
 *
 * Phase 'intro' plays satquery_intro.mp4 while the health check runs in the
 * background. When both finish the app phase begins.
 *
 * Workspace and AI mode stay mounted and hide with CSS rather than unmounting,
 * so tabbing between them never discards a result that is on screen.
 */
export default function App() {
  // --- phase state (login | intro | app) -----------------------------------
  const [phase,   setPhase]   = useState(() => {
    // Restore session on page load — skip login if a valid token exists
    const session = getSession()
    const token   = getToken()
    if (session && (token || MOCK)) return 'app'
    return 'login'
  })

  const [session, setSession] = useState(getSession)

  // Promise ref used to pass the health-check to IntroScreen
  const initPromiseRef = useRef(null)

  // --- view / workspace state ----------------------------------------------
  const [view, setView] = useState('dashboard')

  const [mode,       setMode]       = useState('single')
  const [scenes,     setScenes]     = useState([])
  const [validation, setValidation] = useState(null)
  const [uploading,  setUploading]  = useState(false)

  const [history,     setHistory]     = useState([])
  const [activeTools, setActiveTools] = useState([])
  const [handoff,     setHandoff]     = useState(null)
  const [backend,     setBackend]     = useState('checking')

  // Fetch health whenever we enter 'app' phase
  useEffect(() => {
    if (phase !== 'app') return
    health()
      .then((h) => setBackend(h.model_loaded ? 'ready' : 'loading'))
      .catch(() => setBackend('down'))
  }, [phase])

  // --- handlers ------------------------------------------------------------
  const doUpload = useCallback(async (files, pairType) => {
    setUploading(true)
    try {
      const r = await upload(files, pairType)
      setScenes(r.metadata)
      setValidation(r.validation)
    } catch (e) {
      setValidation({ ok: false, notes: [
        `Upload failed — ${e.message}`,
        'Check the backend URL in .env, then restart Vite.',
      ] })
    } finally {
      setUploading(false)
    }
  }, [])

  const loadSet = useCallback(async (setId) => {
    setMode(setId)
    await doUpload([], setId)
    setView((v) => (v === 'orb' ? 'orb' : 'analyst'))
  }, [doUpload])

  const record = useCallback((entry) => {
    setHistory((h) => [...h, entry])
  }, [])

  const openInMap = useCallback((result, layers) => {
    setHandoff({ result, layers, at: Date.now() })
    setView('analyst')
  }, [])

  const handleSignOut = useCallback(() => {
    signOut()
    setSession(null)
    setHistory([])
    setScenes([])
    setPhase('login')
  }, [])

  const handleProfile = useCallback(() => setView('profile'), [])

  const handleSignIn = useCallback((newSession) => {
    setSession(newSession)
    // Create the health-check promise and pass it to IntroScreen
    initPromiseRef.current = health()
      .then((h) => setBackend(h.model_loaded ? 'ready' : 'loading'))
      .catch(() => setBackend('down'))
    setPhase('intro')
  }, [])

  const handleIntroDone = useCallback(() => {
    setPhase('app')
    setView('dashboard')
  }, [])

  // --- render --------------------------------------------------------------
  if (phase === 'login') {
    return <LoginView onSignIn={handleSignIn} />
  }

  if (phase === 'intro') {
    return <IntroScreen onDone={handleIntroDone} initPromise={initPromiseRef.current} />
  }

  // phase === 'app'
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        view={view} onView={setView} activeTools={activeTools}
        sceneSet={scenes.length ? mode : null} onLoadSet={loadSet}
        session={session} onSignOut={handleSignOut} onProfile={handleProfile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          view={view} backend={backend} mock={MOCK} scenes={scenes}
          reportReady={history.length > 0}
          onReport={() => {
            if (MOCK) window.alert('Mock mode: Reports require the backend.')
            else window.open(reportUrl(session.session_id), '_blank')
          }}
          session={session}
          onSignOut={handleSignOut}
          onProfile={handleProfile}
        />

        <main className="min-h-0 flex-1">
          {view === 'dashboard' && (
            <DashboardView session={session} backend={backend} history={history}
                           onOpen={setView} onLoadSet={loadSet} />
          )}

          {view === 'profile' && (
            <ProfileView session={session} onSignOut={handleSignOut} />
          )}

          <div className={view === 'analyst' ? 'h-full' : 'hidden'}>
          <AnalystView
          scenes={scenes} validation={validation} mode={mode} onMode={setMode}
          uploading={uploading} onUpload={doUpload} onOpen={setView}
          onResult={record} onActiveTool={setActiveTools} preload={handoff}
          />
          </div>

          <div className={view === 'orb' ? 'h-full' : 'hidden'}>
            <OrbView scenes={scenes} onResult={record} onOpenMap={openInMap} onActiveTool={setActiveTools} />
          </div>
        </main>
      </div>
    </div>
  )
}
