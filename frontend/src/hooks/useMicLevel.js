import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Real microphone amplitude via the Web Audio API. The orb's rings are driven
 * by actual frequency data, not a canned animation — if the room is quiet the
 * orb is quiet, which is the whole point of putting a mic on stage.
 *
 * levelRef and bandsRef are refs, not state: the canvas reads them at 60fps and
 * re-rendering React that often would drop frames. A throttled `level` state is
 * exposed separately for anything CSS-driven.
 */
export function useMicLevel() {
  const [active, setActive] = useState(false)
  const [error, setError] = useState(null)
  const [level, setLevel] = useState(0)

  const levelRef = useRef(0)
  const bandsRef = useRef(new Uint8Array(64))
  const ctxRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    ctxRef.current?.close().catch(() => {})
    streamRef.current = null
    ctxRef.current = null
    levelRef.current = 0
    bandsRef.current = new Uint8Array(64)
    setLevel(0)
    setActive(false)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128            // 64 bins — one per ring bar
      analyser.smoothingTimeConstant = 0.72
      src.connect(analyser)

      streamRef.current = stream
      ctxRef.current = ctx
      setActive(true)

      const buf = new Uint8Array(analyser.frequencyBinCount)
      let lastPush = 0

      const tick = (t) => {
        analyser.getByteFrequencyData(buf)
        bandsRef.current = buf

        // Weighted toward speech frequencies so keyboard noise doesn't drive it.
        let sum = 0
        for (let i = 2; i < 40; i++) sum += buf[i]
        const raw = sum / (38 * 255)
        levelRef.current = Math.min(1, raw * 2.1)

        if (t - lastPush > 90) { setLevel(levelRef.current); lastPush = t }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (e) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Microphone blocked. Allow access in the address bar, then press the mic again.'
          : `Microphone unavailable — ${e.message}`
      )
      setActive(false)
    }
  }, [])

  useEffect(() => () => stop(), [stop])

  return { active, error, level, levelRef, bandsRef, start, stop }
}
