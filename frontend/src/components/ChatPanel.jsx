import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import OrbCore from './OrbCore.jsx'
import { useMicLevel } from '../hooks/useMicLevel.js'

/** The quick chips are the demo script, on screen, in order â€” so nobody has to
 *  type accurately under stage lights. */
const CHIPS = {
  single: [
    { label: 'Describe land cover', q: 'Describe the land cover in this scene.' },
    { label: 'Water + vegetation', q: 'Find the water body and tell me whether the surrounding area has vegetation.' },
    { label: 'Where is the water?', q: 'Where exactly is the water body?' },
    { label: 'Out of scope', q: 'What will the crop yield be next year?' },
  ],
  bitemporal: [
    { label: 'What changed?', q: 'What changed between these two dates?' },
    { label: 'Quantify change', q: 'How much of the scene changed, and where?' },
  ],
  cross_modal: [
    { label: 'Water under cloud', q: 'Is there water under these clouds?' },
    { label: 'Do the sensors agree?', q: 'Does the SAR image agree with the optical one?' },
  ],
}

const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

function MicGlyph({ size = 15, off = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="22" />
      {off && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  )
}

function Bubble({ m }) {
  if (m.role === 'user') {
    return (
      <div className="animate-rise rounded rounded-tr-none border border-primary/25 bg-primary-soft px-3 py-2.5">
        <span className="eyebrow text-primary-deep">Query</span>
        <p className="mt-1 text-[13px] leading-relaxed text-ink">{m.text}</p>
      </div>
    )
  }
  return (
    <div className={`animate-rise rounded rounded-tl-none border px-3 py-2.5
                     ${m.abstained ? 'border-carmine/25 bg-carmine-soft' : 'border-rule bg-wash'}`}>
      <span className={`eyebrow ${m.abstained ? 'text-carmine-deep' : ''}`}>
        {m.abstained ? 'Insufficient evidence' : 'Answer'}
      </span>
      <p className="mt-1 text-[13px] leading-relaxed text-ink">{m.text}</p>
    </div>
  )
}

/**
 * Voice dock. Sits above the input while listening.
 *
 * The orb is the same component the AI Mode page uses, at a smaller size and
 * fed by the same mic hook â€” one implementation, two scales. Docking it here
 * rather than routing to AI Mode means a spoken query doesn't cost you the map,
 * which matters when the overlay on screen is the thing being discussed.
 */
function VoiceDock({ level, levelRef, bandsRef, transcript, error, onStop, onExpand }) {
  return (
    <div className="animate-rise border-t border-rule bg-wash px-3 py-3">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
          <OrbCore state={error ? 'flagged' : 'listening'}
                   levelRef={levelRef} bandsRef={bandsRef} size={64} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="eyebrow" style={{ color: error ? '#9F1239' : '#1D4ED8' }}>
              {error ? 'Microphone' : 'Listening'}
            </span>
            {!error && (
              <span className="flex items-end gap-[2px]" style={{ height: 11 }} aria-hidden="true">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="w-[2px] rounded-full bg-accent"
                        style={{
                          height: `${3 + Math.min(1, level * (1.5 - Math.abs(i - 2) * 0.22)) * 8}px`,
                          opacity: 0.45 + level * 0.55,
                          transition: 'height 90ms linear, opacity 90ms linear',
                        }} />
                ))}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[12.5px] leading-snug text-ink">
            {error || transcript || 'Say what you want to know about this scene.'}
          </p>
        </div>

        {onExpand && !error && (
          <button onClick={onExpand} title="Open AI Mode"
                  className="btn btn-ghost shrink-0 px-2 py-1.5 text-[11px]">
            <Icon name="orb" size={13} />
            Expand
          </button>
        )}
        <button onClick={onStop} className="btn shrink-0 px-2.5 py-1.5 text-[11px]">
          {error ? 'Dismiss' : 'Stop'}
        </button>
      </div>
    </div>
  )
}

export default function ChatPanel({ messages, busy, ready, mode, onSend, onExpand, children }) {
  const [text, setText] = useState('')
  const [voice, setVoice] = useState(false)
  const [heard, setHeard] = useState('')
  const [voiceError, setVoiceError] = useState(null)
  const end = useRef(null)
  const recRef = useRef(null)
  const sentRef = useRef(false)

  const mic = useMicLevel()

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const send = useCallback((q) => {
    const v = (q ?? text).trim()
    if (!v || busy || !ready) return
    onSend(v)
    setText('')
  }, [text, busy, ready, onSend])

  const stopVoice = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    recRef.current = null
    mic.stop()
    setVoice(false)
    setHeard('')
    setVoiceError(null)
  }, [mic])

  const startVoice = useCallback(async () => {
    if (!SR) {
      setVoiceError('Voice input needs Chrome or Edge. Type the query instead.')
      setVoice(true)
      return
    }
    setVoiceError(null)
    setHeard('')
    sentRef.current = false
    setVoice(true)
    await mic.start()

    const rec = new SR()
    rec.lang = 'en-IN'
    rec.interimResults = true
    rec.continuous = false

    rec.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) final += chunk
        else interim += chunk
      }
      setHeard(final || interim)
      // A finished utterance runs immediately â€” a voice query that still needs
      // a click isn't a voice query.
      if (final.trim() && !sentRef.current) {
        sentRef.current = true
        const q = final.trim()
        stopVoice()
        setTimeout(() => send(q), 60)
      }
    }
    rec.onerror = (e) => {
      setVoiceError(
        e.error === 'not-allowed'
          ? 'Microphone blocked. Allow access in the address bar, then press the mic again.'
          : `Speech recognition failed â€” ${e.error}`
      )
      mic.stop()
    }
    rec.onend = () => { if (!sentRef.current) { mic.stop(); setVoice(false) } }

    try { rec.start(); recRef.current = rec } catch {
      setVoiceError('Could not start the microphone. Press the mic again.')
    }
  }, [mic, send, stopVoice])

  useEffect(() => () => { try { recRef.current?.stop() } catch {} }, [])

  /* AnalystView stays mounted when the view switches, so leaving for AI Mode
     without releasing the mic would leave two recognizers fighting over the
     same device. Hand the microphone back first. */
  const expand = useCallback(() => {
    if (voice) stopVoice()
    onExpand?.()
  }, [voice, stopVoice, onExpand])

  const micError = voiceError || mic.error

  return (
    <section className="flex min-h-0 flex-col rounded border border-rule bg-sheet shadow-sheet"
             style={{ flex: '1 1 42%' }}>
      <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
        <Icon name="vqa" size={15} className="text-ink3" />
        <span className="eyebrow">Query</span>
        {onExpand && (
          <button onClick={expand}
                  className="ml-auto flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] text-ink3
                             transition-colors hover:bg-wash hover:text-accent-deep">
            <Icon name="orb" size={12} />
            AI Mode
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="readout px-1 leading-relaxed text-ink3">
            {ready
              ? 'Ask in plain language, or press the mic. The router picks the tools and the trace shows what ran.'
              : 'Load a scene to begin.'}
          </p>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && (
          <div className="flex items-center gap-2 px-1">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-ochre" />
            <span className="readout text-ochre-deep">running toolsâ€¦</span>
          </div>
        )}
        <div ref={end} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-rule px-3 py-2.5">
        {(CHIPS[mode] || []).map((c) => (
          <button key={c.label} onClick={() => send(c.q)} disabled={busy || !ready}
                  className="key key-mute transition-colors hover:border-primary/40 hover:bg-primary-soft
                             hover:text-primary-deep disabled:opacity-40 disabled:pointer-events-none">
            {c.label}
          </button>
        ))}
      </div>

      {voice && (
        <VoiceDock
          level={mic.level} levelRef={mic.levelRef} bandsRef={mic.bandsRef}
          transcript={heard} error={micError}
          onStop={stopVoice} onExpand={onExpand ? expand : undefined}
        />
      )}

      <div className="flex items-center gap-2 border-t border-rule px-3 py-2.5">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy || !ready}
          placeholder={ready ? 'Ask about this sceneâ€¦' : 'Load a scene first'}
          className="field py-2 text-[12px] disabled:opacity-50" />

        <button
          onClick={() => (voice ? stopVoice() : startVoice())}
          disabled={busy || !ready}
          aria-label={voice ? 'Stop listening' : 'Ask by voice'}
          title={voice ? 'Stop listening' : 'Ask by voice'}
          className={`btn shrink-0 px-2.5 py-2 ${voice ? 'border-accent bg-accent-soft text-accent-deep' : ''}
                      disabled:opacity-40 disabled:pointer-events-none`}
          style={voice && !micError
            ? { boxShadow: `0 0 0 ${2 + mic.level * 6}px rgba(37,99,235,${0.10 + mic.level * 0.16})`,
                transition: 'box-shadow 90ms linear' }
            : undefined}
        >
          <MicGlyph size={15} off={voice} />
        </button>

        <button onClick={() => send()} disabled={busy || !ready || !text.trim()}
                className="btn btn-primary shrink-0 px-3 py-2">
          Run
        </button>
      </div>

      {children}
    </section>
  )
}