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
 *  - colour travels from a calm blue toward cyan with vocal energy, so volume
 *    is legible from the back of a room, not just amplitude of the bars;
 *  - each syllable emits a ripple that expands and dies, which is what makes it
 *    read as listening rather than merely animated;
 *  - with the mic off it breathes on a slow sine rather than faking audio.
 *
 * Canvas, not SVG: this repaints every frame off two refs, and pushing 60fps of
 * audio through React state would drop frames.
 */

/* Calm and hot ends for each state. Colour is interpolated between them by
   energy, so the orb brightens as you speak instead of switching palettes. */
const RGB = {
  idle:      { calm: [37, 99, 235],  hot: [56, 189, 248] },
  listening: { calm: [37, 99, 235],  hot: [34, 211, 238] },
  thinking:  { calm: [217, 119, 6],  hot: [251, 191, 36] },
  answering: { calm: [5, 150, 105],  hot: [52, 211, 153] },
  flagged:   { calm: [225, 29, 72],  hot: [251, 113, 133] },
}

const BINS = 64
const mix = (a, b, t) => Math.round(a + (b - a) * t)

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

    const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const cx = size / 2
    const cy = size / 2
    const baseR = size * 0.155

    /* Below ~120px the graticule and dashed arcs turn to mush, so the compact
       docked orb drops them and leans on the bars and ripples instead. */
    const compact = size < 120
    const bins = compact ? 32 : BINS

    let raf
    let smooth = 0
    let prevLevel = 0
    let ripples = []
    let lastRipple = 0

    const draw = (ms) => {
      const t = ms / 1000
      const st = stateRef.current
      const pair = RGB[st] || RGB.idle

      const live = st === 'listening'
      const target = live ? (levelRef?.current ?? 0) : 0
      smooth += (target - smooth) * 0.18

      const breath = calmMotion ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.15)
      const energy = live ? smooth : breath * 0.2 + (st === 'thinking' ? 0.28 : 0)

      // Colour travels with energy. Eased so quiet speech still shifts visibly.
      const heat = Math.min(1, Math.pow(energy, 0.7) * 1.15)
      const r = mix(pair.calm[0], pair.hot[0], heat)
      const g = mix(pair.calm[1], pair.hot[1], heat)
      const b = mix(pair.calm[2], pair.hot[2], heat)
      const rgba = (a) => `rgba(${r},${g},${b},${a})`

      /* Ripple on the rising edge of a syllable. The 110ms gate stops a loud
         sustained vowel from emitting a solid wall of rings. */
      if (live && !calmMotion) {
        const rising = smooth - prevLevel
        if (smooth > 0.17 && rising > 0.035 && ms - lastRipple > 110) {
          ripples.push({ born: ms, power: Math.min(1, smooth * 1.4) })
          lastRipple = ms
        }
      }
      prevLevel = smooth
      ripples = ripples.filter((p) => ms - p.born < 1400)

      ctx.clearRect(0, 0, size, size)

      // 1 — wash. A printed halo, not a glow.
      const wash = ctx.createRadialGradient(cx, cy, baseR * 0.4, cx, cy, size * 0.48)
      wash.addColorStop(0, rgba(0.16 + energy * 0.18))
      wash.addColorStop(0.5, rgba(0.05 + energy * 0.07))
      wash.addColorStop(1, rgba(0))
      ctx.fillStyle = wash
      ctx.fillRect(0, 0, size, size)

      // 2 — ripples. Expanding rings, eased out, thinning as they go.
      ripples.forEach((p) => {
        const age = (ms - p.born) / 1400
        const ease = 1 - Math.pow(1 - age, 2.4)
        const rad = baseR * 1.5 + ease * size * 0.34
        const fade = (1 - age) * (1 - age) * p.power
        if (fade <= 0.005) return
        ctx.strokeStyle = rgba(fade * 0.55)
        ctx.lineWidth = (1 + p.power * 1.8) * (1 - age * 0.7)
        ctx.beginPath()
        ctx.arc(cx, cy, rad, 0, Math.PI * 2)
        ctx.stroke()
      })

      // 3 — spectrum ring, one bar per FFT bin
      const bands = bandsRef?.current
      const inner = baseR * 1.5
      const step = BINS / bins
      ctx.lineCap = 'round'
      for (let i = 0; i < bins; i++) {
        const a = (i / bins) * Math.PI * 2 - Math.PI / 2
        const amp = live && bands
          ? (bands[Math.floor(i * step)] || 0) / 255
          : 0.09 + 0.06 * Math.sin(t * 1.8 + i * 0.42) + (st === 'thinking' ? 0.09 : 0)
        const len = 3 + amp * size * 0.16
        ctx.strokeStyle = rgba(0.24 + amp * 0.68)
        ctx.lineWidth = size * (compact ? 0.016 : 0.0092)
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner)
        ctx.lineTo(cx + Math.cos(a) * (inner + len), cy + Math.sin(a) * (inner + len))
        ctx.stroke()
      }

      // 4 — orbital arcs. They spin faster while the router is working; that is
      //     the only motion cue that a tool is actually running.
      if (!compact) {
        const spin = calmMotion ? 0 : t * (st === 'thinking' ? 1.5 : 0.3)
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
      }

      // 5 — the sphere sits on the paper, so it casts rather than radiates
      ctx.save()
      ctx.shadowBlur = 18 + energy * 22
      ctx.shadowColor = rgba(0.32)
      ctx.shadowOffsetY = 4
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      const core = ctx.createRadialGradient(cx - baseR * 0.25, cy - baseR * 0.3, 1, cx, cy, baseR)
      core.addColorStop(0, '#FFFFFF')
      core.addColorStop(0.45, rgba(0.14 + energy * 0.14))
      core.addColorStop(1, rgba(0.62 + energy * 0.32))
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, baseR, 0, Math.PI * 2)
      ctx.fill()

      // 6 — shell
      ctx.strokeStyle = rgba(0.92)
      ctx.lineWidth = size * 0.016 * (1 + energy * 0.6)
      ctx.beginPath()
      ctx.arc(cx, cy, baseR * (1 + energy * 0.07), 0, Math.PI * 2)
      ctx.stroke()

      // 7 — graticule across the sphere, so it reads as a globe not a bubble
      if (!compact) {
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
        if (!calmMotion) {
          ctx.fillStyle = rgba(0.1)
          const w = baseR * (0.6 + 0.4 * Math.sin(t * 0.5))
          ctx.beginPath()
          ctx.ellipse(cx + baseR * 0.5, cy, w, baseR, 0, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [size, levelRef, bandsRef])

  return <canvas ref={canvas} style={{ width: size, height: size }} aria-hidden="true" />
}
