import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { query as runQuery } from '../api.js'
import { OVERLAYS } from '../mockData.js'
import { useMicLevel } from '../hooks/useMicLevel.js'
import { useSpeech, LANGUAGES, speechSupported } from '../hooks/useSpeech.js'
import Icon from '../components/Icon.jsx'
import OrbCore from '../components/OrbCore.jsx'
import NodeGraph from '../components/NodeGraph.jsx'
import ResultCard from '../components/ResultCard.jsx'

const TOOLS = [
  { id: 'vqa',       label: 'VQA',       sub: 'Qwen2.5-VL',     kind: 'primary'    },
  { id: 'grounding', label: 'Grounding', sub: 'native boxes',   kind: 'primary'    },
  { id: 'indices',   label: 'Indices',   sub: 'NDVI NDWI NDBI', kind: 'moss'    },
  { id: 'fusion',    label: 'Fusion',    sub: 'optical × SAR',  kind: 'ochre'   },
  { id: 'change',    label: 'Change',    sub: 'bi-temporal',    kind: 'carmine' },
]

const KEY_CLASS = { primary: 'key-primary', ochre: 'key-ochre', carmine: 'key-carmine', moss: 'key-moss' }

const PROMPTS = [
  'Describe the land cover in this scene.',
  'Find the water body and tell me whether the surrounding area has vegetation.',
  'Is there water under these clouds?',
  'What changed between these two dates?',
]

/** Measures the stage so the connector curves land on the cards in real pixels. */
function useStageSize(ref) {
  const [box, setBox] = useState({ w: 1200, h: 640 })
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect
      if (w > 0 && h > 0) setBox({ w, h })    // a hidden tab reports 0×0
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return box
}

export default function OrbView({ scenes, onResult, onOpenMap, onActiveTool }) {
  const stage = useRef(null)
  const { w: W, h: H } = useStageSize(stage)

  const [phase, setPhase] = useState('idle')   // idle | listening | thinking | answering | flagged
  const [transcript, setTranscript] = useState('')
  const [typed, setTyped] = useState('')
  const [lang, setLang] = useState('en-IN')
  const [trace, setTrace] = useState([])
  const [result, setResult] = useState(null)
  const [layers, setLayers] = useState([])
  const [dismissed, setDismissed] = useState([])
  const abort = useRef(null)

  const mic = useMicLevel()
  const speech = useSpeech(lang)

  const docked = !!result || trace.length > 0
  const ready = scenes.length > 0

  const send = useCallback((text) => {
    if (!text?.trim() || !ready) return
    speech.hush()
    setTranscript(text)
    setTrace([]); setResult(null); setLayers([]); setDismissed([])
    setPhase('thinking')

    abort.current = runQuery({
      sceneIds: scenes.map((s) => s.id),
      text,
      onEvent: (ev) => {
        if (ev.event === 'trace_step') setTrace((t) => [...t, ev.data])
        if (ev.event === 'final') {
          const d = ev.data
          setResult(d)
          setLayers((d.overlays || []).map((id) => ({ id, ...OVERLAYS[id] })).filter((l) => l.url))
          setPhase(d.abstained ? 'flagged' : 'answering')
          speech.speak(d.text)
          onResult?.({ query: text, task: d.basis, confidence: d.confidence, abstained: d.abstained })
        }
      },
      onError: (e) => {
        setPhase('flagged')
        setResult({
          text: `The backend didn't respond — ${e.message}. Check that Colab is still running and the ngrok URL in .env matches.`,
          confidence: 0, basis: 'transport_error', abstained: true,
        })
      },
    })
  }, [scenes, ready, speech, onResult])

  // The mic drives two things at once: the analyser feeds the orb's rings, and
  // the recogniser turns the same speech into a query. Both stop together.
  const toggleMic = () => {
    if (speech.listening) { speech.stop(); mic.stop(); setPhase('idle'); return }
    setPhase('listening')
    mic.start()
    speech.listen((text) => { mic.stop(); send(text) })
  }

  useEffect(() => {
    if (!speech.listening && phase === 'listening' && !mic.active) setPhase('idle')
  }, [speech.listening, mic.active, phase])

  useEffect(() => () => { abort.current?.(); mic.stop() }, []) // eslint-disable-line

  const reset = () => {
    abort.current?.()
    setTrace([]); setResult(null); setLayers([]); setTranscript(''); setPhase('idle')
    speech.hush()
  }

  // --- geometry -------------------------------------------------------------
  const orbSize = docked ? Math.min(180, W * 0.16) : Math.min(320, W * 0.3, H * 0.52)
  const orb = docked
    ? { x: W - orbSize * 0.66, y: orbSize * 0.66 }
    : { x: W / 2, y: H / 2 - 40 }

  const cardW = Math.min(376, Math.max(256, W * 0.28))
  const slots = {
    answer:   { left: W * 0.03, top: H * 0.18 },
    evidence: { left: W * 0.31, top: H * 0.42 },
    trace:    { left: W * 0.62, top: H * 0.38 },
  }

  const activeTools = trace.map((s) => s.tool).filter((t) => TOOLS.some((x) => x.id === t))
  useEffect(() => { onActiveTool?.([...new Set(activeTools)]) }, [trace]) // eslint-disable-line
  const inputs = ready
    ? scenes.map((s) => ({
        id: s.id,
        label: s.sensor === 'S1' ? 'Sentinel-1' : 'Sentinel-2',
        sub: `${s.acquired?.slice(0, 10)} · ${s.gsd}m`,
        kind: s.sensor === 'S1' ? 'ochre' : 'primary',
        live: true,
      })).concat([{ id: 'crs', label: 'EPSG:32643', sub: 'affine · georeferenced', kind: 'primary', live: true }])
    : [{ id: 'none', label: 'No scene', sub: 'load one to begin', kind: 'idle', live: false }]

  const shown = (id) => !dismissed.includes(id)
  const drop = (id) => setDismissed((d) => [...d, id])

  const STATUS = {
    idle:      ['Ready', 'key-mute'],
    listening: ['Listening', 'key-primary'],
    thinking:  ['Selecting tools', 'key-ochre'],
    answering: ['Answered', 'key-primary'],
    flagged:   ['Flagged for review', 'key-carmine'],
  }[phase]

  /* Written out in full because Tailwind scans source text and cannot see a
     class name assembled at runtime. */
  const confTone = (c, ab) => ab
    ? { text: 'text-carmine-deep', bar: 'bg-carmine' }
    : c >= 0.75
      ? { text: 'text-primary-deep', bar: 'bg-primary' }
      : { text: 'text-ochre-deep', bar: 'bg-ochre' }

  return (
    <div ref={stage} className="relative h-full w-full overflow-hidden">
      <NodeGraph inputs={inputs} tools={TOOLS} activeTools={activeTools}
                 cx={orb.x} cy={orb.y} width={W} height={H} />

      {/* leaders from the orb out to each open card */}
      {docked && (
        <svg width={W} height={H} className="pointer-events-none absolute inset-0">
          {Object.entries(slots).map(([k, s]) => {
            if (!shown(k)) return null
            const tx = s.left + cardW / 2
            const mx = (orb.x + tx) / 2
            return (
              <path key={k} d={`M ${orb.x} ${orb.y} C ${mx} ${orb.y}, ${mx} ${s.top}, ${tx} ${s.top}`}
                    fill="none" stroke="#C1CDDA" strokeWidth="1.2" strokeDasharray="4 4" />
            )
          })}
        </svg>
      )}

      <div className="pointer-events-none absolute transition-all duration-[900ms] ease-[cubic-bezier(0.2,0.9,0.2,1)]"
           style={{ left: orb.x - orbSize / 2, top: orb.y - orbSize / 2 }}>
        <OrbCore state={phase} levelRef={mic.levelRef} bandsRef={mic.bandsRef} size={orbSize} />
      </div>

      {!docked && (
        <div className="pointer-events-none absolute inset-x-0 text-center"
             style={{ top: orb.y + orbSize * 0.58 }}>
          <span className={`key ${STATUS[1]}`}>{STATUS[0]}</span>
          <p className="mx-auto mt-3 max-w-md px-6 text-[15px] leading-relaxed text-ink2">
            {!ready
              ? 'No scene loaded. Pick one from the scene library in the sidebar.'
              : speech.interim || transcript || 'Press the mic and ask, or type below.'}
          </p>
        </div>
      )}

      {/* answer */}
      {result && shown('answer') && (
        <ResultCard title={result.abstained ? 'Insufficient evidence' : 'Answer'}
                    kind={result.abstained ? 'carmine' : 'primary'} delay={80}
                    onClose={() => drop('answer')}
                    style={{ left: slots.answer.left, top: slots.answer.top, width: cardW }}>
          <p className="text-[13px] leading-relaxed text-ink">{result.text}</p>
          <div className="mt-3 border-t border-rule pt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="eyebrow">{result.abstained ? 'Abstained' : 'Confidence'}</span>
              <span className={`ml-auto font-display text-[15px] font-bold tabular-nums
                                ${confTone(result.confidence, result.abstained).text}`}>
                {Math.round(result.confidence * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rule">
              <div className={`h-full rounded-full transition-[width] duration-700 ease-out
                               ${confTone(result.confidence, result.abstained).bar}`}
                   style={{ width: `${result.confidence * 100}%` }} />
            </div>
            <p className="mt-1.5 readout text-ink3">{result.basis}</p>
          </div>
        </ResultCard>
      )}

      {/* evidence */}
      {result && shown('evidence') && (
        <ResultCard title="Evidence" kind={layers[0]?.kind || 'primary'} delay={220}
                    onClose={() => drop('evidence')}
                    style={{ left: slots.evidence.left, top: slots.evidence.top, width: cardW }}>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-rule">
            <img src={scenes[0]?.preview_png} alt="" className="absolute inset-0 h-full w-full object-cover" />
            {layers.map((l) => (
              <img key={l.id} src={l.url} alt=""
                   className="absolute inset-0 h-full w-full object-cover opacity-75" />
            ))}
            {result.geojson && (
              <div className="absolute left-[26%] right-[22%] top-[18%] h-[36%] rounded-sm
                              border-2 border-dashed border-primary" />
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {layers.map((l) => (
              <span key={l.id} className={`key ${KEY_CLASS[l.kind] || 'key-mute'}`}>{l.label}</span>
            ))}
            {layers.length === 0 && <span className="readout text-ink3">no mask produced</span>}
          </div>
          <button onClick={() => onOpenMap(result, layers)} className="btn mt-3 w-full">
            <Icon name="layers" size={15} />
            Open in map
          </button>
        </ResultCard>
      )}

      {/* trace */}
      {trace.length > 0 && shown('trace') && (
        <ResultCard title="Execution trace" kind="ochre" delay={360}
                    runtime={trace.reduce((a, s) => a + s.runtime_ms, 0)}
                    onClose={() => drop('trace')}
                    style={{ left: slots.trace.left, top: slots.trace.top, width: Math.min(cardW, 320) }}>
          <ol className="space-y-2.5">
            {trace.map((s) => (
              <li key={s.step} className="animate-rise border-l-2 border-ochre/35 pl-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="readout text-ink3">{String(s.step).padStart(2, '0')}</span>
                  <span className="font-display text-[12px] font-semibold tracking-tightest">{s.label}</span>
                  <span className="readout ml-auto text-ink3">{s.runtime_ms}ms</span>
                </div>
                <p className="mt-0.5 readout text-ink2">{s.detail}</p>
              </li>
            ))}
          </ol>
        </ResultCard>
      )}

      {/* console */}
      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-rule bg-sheet/95 backdrop-blur">
        {(mic.error || speech.error) && (
          <p className="border-b border-carmine/25 bg-carmine-soft px-4 py-2 text-center text-[12px] text-carmine-deep">
            {mic.error || speech.error}
          </p>
        )}

        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-5 py-3">
          <button
            onClick={toggleMic} disabled={!ready}
            aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
            className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border
                        transition-all disabled:opacity-40 disabled:pointer-events-none
                        ${speech.listening
                          ? 'border-primary bg-primary text-white shadow-lift'
                          : 'border-rule bg-sheet text-ink2 shadow-sheet hover:border-primary hover:text-primary'}`}
          >
            {speech.listening && <span className="absolute -inset-1 animate-ping rounded-full border border-primary/50" />}
            <Icon name="mic" size={18} />
          </button>

          <input
            value={speech.listening ? speech.interim : typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { send(typed); setTyped('') } }}
            disabled={!ready || speech.listening}
            placeholder={ready ? 'Ask about this scene…' : 'Load a scene from the sidebar first'}
            className="field flex-1 disabled:opacity-60"
          />

          <select
            value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Speech language"
            className="shrink-0 rounded border border-rule bg-sheet px-2.5 py-2.5 font-mono text-[11px]
                       text-ink2 focus:border-primary focus:shadow-key focus:outline-none"
          >
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          {docked && <button onClick={reset} className="btn shrink-0 py-2.5">Clear</button>}
        </div>

        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-5 pb-3">
          {PROMPTS.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={!ready}
                    className="key key-mute transition-colors hover:border-primary/40 hover:bg-primary-soft
                               hover:text-primary-deep disabled:opacity-40 disabled:pointer-events-none">
              {p.length > 44 ? p.slice(0, 42) + '…' : p}
            </button>
          ))}
          {!speechSupported && (
            <span className="readout ml-auto text-ink3">voice needs Chrome · typing works everywhere</span>
          )}
        </div>
      </div>
    </div>
  )
}
