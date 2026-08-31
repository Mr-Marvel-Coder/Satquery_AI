import { useEffect, useRef } from 'react'

/**
 * The orb, plotted rather than lit.
 *
 * On paper a neon bloom would look wrong, so this is drawn the way an
 * instrument prints: a dense radial line figure, ink-weighted, with a soft
 * coloured wash instead of a glow. Everything it does is driven by real signal —
 *
 *  - the radiating bars are live FFT bins from the microphone, so a quiet room
 *    gives a quiet orb;
 *  - the ring colour is the system state, on the same legend keys as the rest of
 *    the app (primary nominal, ochre working, carmine flagged);
 *  - with the mic off it breathes on a slow sine rather than faking audio.
 *
 * Canvas, not SVG: this repaints every frame off two refs, and pushing 60fps of
 * audio through React state would drop frames.
 */
const RGB = {
  idle:      [11, 114, 133],
  listening: [11, 114, 133],
  thinking:  [169, 97, 10],
  answering: [11, 114, 133],
  flagged:   [176, 38, 76],
}

const BINS = 64

export default function OrbCore({ state = 'idle', levelRef, bandsRef, size = 300 }) {
  const canvas = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = size * dpr
    cv.height = size * dpr
    ctx.scale(dpr, dpr)

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cx = size / 2
    const cy = size / 2
    const baseR = size * 0.155

    let raf
    let smooth = 0

    const draw = (ms) => {
      const t = ms / 1000
      const st = stateRef.current
      const [r, g, b] = RGB[st] || RGB.idle
      const rgba = (a) => `rgba(${r},${g},${b},${a})`

      const live = st === 'listening'
      const target = live ? (levelRef?.current ?? 0) : 0
      smooth += (target - smooth) * 0.18

      const breath = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.15)
      const energy = live ? smooth : breath * 0.2 + (st === 'thinking' ? 0.28 : 0)

      ctx.clearRect(0, 0, size, size)

      // 1 — wash. A printed halo, not a glow.
      const wash = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, size * 0.48)
      wash.addColorStop(0, rgba(0.16 + energy * 0.16))
      wash.addColorStop(0.5, rgba(0.05 + energy * 0.06))
      wash.addColorStop(1, rgba(0))
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, size, size)

      // 2 — spectrum ring, one bar per FFT bin
      const bands = bandsRef?.current
      const inner = baseR * 1.5
      ctx.lineCap = 'round'
      for (let i = 0; i < BINS; i++) {
        const a = (i / BINS) * Math.PI * 2 - Math.PI / 2
        const amp = live && bands
          ? (bands[i] || 0) / 255
          : 0.09 + 0.06 * Math.sin(t * 1.8 + i * 0.42) + (st === 'thinking' ? 0.09 : 0)
        const len = 3 + amp * size * 0.15
        ctx.strokeStyle = rgba(0.24 + amp * 0.66)
        ctx.lineWidth = size * 0.0092
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        ctx.lineTo(cx + Math.cos(a) * (inner + len), cy + Math.sin(a) * (inner + len))
        ctx.stroke()
      }

      // 3 — orbital arcs. They spin faster while the router is working; that is
      //     the only motion cue that a tool is actually running.
      const spin = calm ? 0 : t * (st === 'thinking' ? 1.5 : 0.3)
      ;[[baseR * 1.98, 0.5, 1], [baseR * 2.26, 0.32, -1.5]].forEach(([rad, alpha, dir], k) => {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(spin * dir + k)
        ctx.strokeStyle = rgba(alpha * (0.5 + energy * 0.5))
        ctx.lineWidth = 1.1
        ctx.setLineDash([rad * 0.42, rad * 0.3])
        ctx.beginPath()
        ctx.arc(0, 0, rad, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })
      ctx.setLineDash([])

      // 4 — the sphere sits on the paper, so it casts rather than radiates
      ctx.save()
      ctx.shadowBlur = 18 + energy * 20
      ctx.shadowColor = rgba(0.3)
      ctx.shadowOffsetY = 4
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      const core = ctx.createRadialGradient(cx - baseR * 0.25, cy - baseR * 0.3, 1, cx, cy, baseR)
      core.addColorStop(0, '#FFFFFF')
      core.addColorStop(0.45, rgba(0.14 + energy * 0.12))
      core.addColorStop(1, rgba(0.62 + energy * 0.3))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.fill()

      // 5 — shell
      ctx.strokeStyle = rgba(0.92)
      ctx.lineWidth = size * 0.016 * (1 + energy * 0.55)
      ctx.beginPath()
      ctx.arc(cx, cy, baseR * (1 + energy * 0.06), 0, Math.PI * 2)
      ctx.stroke()

      // 6 — graticule across the sphere, so it reads as a globe not a bubble
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, baseR * 0.96, 0, Math.PI * 2)
      ctx.clip()
      ctx.strokeStyle = rgba(0.3)
      ctx.lineWidth = 0.9
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.ellipse(cx, cy, baseR * (0.28 + Math.abs(i) * 0.26), baseR, 0, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - baseR, cy + i * baseR * 0.42)
        ctx.lineTo(cx + baseR, cy + i * baseR * 0.42)
        ctx.stroke()
      }
      // a rotating terminator keeps the sphere alive without animating colour
      if (!calm) {
        ctx.fillStyle = rgba(0.1)
        const w = baseR * (0.6 + 0.4 * Math.sin(t * 0.5))
        ctx.beginPath()
        ctx.ellipse(cx + baseR * 0.5, cy, w, baseR, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size, levelRef, bandsRef])

  return <canvas ref={canvas} style={{ width: size, height: size }} aria-hidden="true" />
}
