import { useEffect, useRef, useState } from 'react'

/**
 * Post-login intro screen.
 *
 * Plays satquery_intro.mp4 while the dashboard initializes in the background.
 * Transitions to the dashboard when:
 *   - The video ends naturally, OR
 *   - The MAX_DURATION timeout expires (safety net), OR
 *   - The video fails to play (graceful fallback after a brief pause)
 *
 * Dashboard data load (health check) runs concurrently — the intro waits for
 * BOTH the video to finish AND the health check to resolve before handing off.
 * If the backend takes longer than the video, we show a subtle loading indicator.
 */

const MIN_INTRO_MS  = 1200   // minimum time before transition even if backend is instant
const MAX_INTRO_MS  = 12000  // maximum time before we forcibly transition (safety net)
const FALLBACK_MS   = 1800   // if video fails to load/play, wait this long then transition

export default function IntroScreen({ onDone, initPromise }) {
  const videoRef   = useRef(null)
  const [status, setStatus] = useState('playing')   // playing | waiting | ready | error

  useEffect(() => {
    let cancelled = false
    let videoEnded = false
    let backendReady = false
    let safetyTimer = null
    let minTimer = null

    function tryTransition() {
      if (cancelled) return
      if (videoEnded && backendReady) {
        setStatus('ready')
        setTimeout(() => { if (!cancelled) onDone() }, 400)
      } else if (videoEnded && !backendReady) {
        setStatus('waiting')
      }
    }

    // Safety-net: always resolve after MAX_INTRO_MS regardless of state
    safetyTimer = setTimeout(() => {
      if (!cancelled) { backendReady = true; videoEnded = true; tryTransition() }
    }, MAX_INTRO_MS)

    // Minimum display time — prevents instant flash
    minTimer = setTimeout(() => {
      // After min time, if backend already resolved, mark it done
    }, MIN_INTRO_MS)

    // Backend initialization
    const backendCheck = initPromise || Promise.resolve()
    backendCheck.finally(() => {
      if (!cancelled) {
        backendReady = true
        tryTransition()
      }
    })

    // Video events
    const video = videoRef.current
    if (video) {
      const onEnded = () => {
        if (!cancelled) { videoEnded = true; tryTransition() }
      }
      const onError = () => {
        // Video failed — wait briefly then transition
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) { videoEnded = true; backendReady = true; tryTransition() }
          }, FALLBACK_MS)
        }
      }
      const onCanPlay = () => {
        video.play().catch(() => {
          // Autoplay blocked — just wait for the safety timer
          setStatus('waiting')
        })
      }

      video.addEventListener('ended',    onEnded)
      video.addEventListener('error',    onError)
      video.addEventListener('canplay',  onCanPlay)

      return () => {
        cancelled = true
        clearTimeout(safetyTimer)
        clearTimeout(minTimer)
        video.removeEventListener('ended',   onEnded)
        video.removeEventListener('error',   onError)
        video.removeEventListener('canplay', onCanPlay)
      }
    } else {
      // No video element — just run the safety timer
      return () => {
        cancelled = true
        clearTimeout(safetyTimer)
        clearTimeout(minTimer)
      }
    }
  }, [onDone, initPromise])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink
                  transition-opacity duration-500 ${status === 'ready' ? 'opacity-0' : 'opacity-100'}`}
      aria-label="Loading SatQuery"
      role="status"
    >
      {/* Intro video */}
      <video
        ref={videoRef}
        src="/satquery_intro.mp4"
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-cover"
        aria-hidden="true"
      />

      {/* Waiting for backend overlay — shown after video ends but backend isn't ready */}
      {status === 'waiting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center
                        bg-ink/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/satquery_logo.png"
              alt="SatQuery"
              className="h-14 w-auto object-contain opacity-90"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 animate-spin text-primary" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-ink3">
                Initialising…
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
