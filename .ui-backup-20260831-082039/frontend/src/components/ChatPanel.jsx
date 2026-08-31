import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

/** The quick chips are the demo script, on screen, in order — so nobody has to
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

export default function ChatPanel({ messages, busy, ready, mode, onSend, children }) {
  const [text, setText] = useState('')
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])

  const send = (q) => {
    const v = (q ?? text).trim()
    if (!v || busy || !ready) return
    onSend(v)
    setText('')
  }

  return (
    <section className="flex min-h-0 flex-col rounded border border-rule bg-sheet shadow-sheet"
             style={{ flex: '1 1 42%' }}>
      <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
        <Icon name="vqa" size={15} className="text-ink3" />
        <span className="eyebrow">Query</span>
      </header>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="readout px-1 leading-relaxed text-ink3">
            {ready
              ? 'Ask in plain language. The router picks the tools and the trace shows what ran.'
              : 'Load a scene to begin.'}
          </p>
        )}
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && (
          <div className="flex items-center gap-2 px-1">
            <span className="h-1.5 w-1.5 animate-pulse2 rounded-full bg-ochre" />
            <span className="readout text-ochre-deep">running tools…</span>
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

      <div className="flex items-center gap-2 border-t border-rule px-3 py-2.5">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={busy || !ready}
          placeholder={ready ? 'Ask about this scene…' : 'Load a scene first'}
          className="field py-2 text-[12px] disabled:opacity-50" />
        <button onClick={() => send()} disabled={busy || !ready || !text.trim()}
                className="btn btn-primary shrink-0 px-3 py-2">
          Run
        </button>
      </div>

      {children}
    </section>
  )
}
