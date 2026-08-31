import { useEffect, useState } from 'react'
import { MOCK, fetchHistory } from '../api.js'
import Icon from '../components/Icon.jsx'

const SCENE_SETS = [
  {
    id: 'single',
    name: 'Koyna basin',
    sensors: ['S2'],
    date: '2024-03-14',
    icon: 'globe',
    type: 'Single scene',
    note: 'Single Sentinel-2 tile. Baseline VQA, grounding and indices.',
    tags: ['VQA', 'Grounding', 'Indices'],
  },
  {
    id: 'bitemporal',
    name: 'Koyna basin Δt',
    sensors: ['S2', 'S2'],
    date: '2022-03 → 2024-03',
    icon: 'change',
    type: 'Bi-temporal',
    note: 'Matched acquisition months, so seasonal variation is controlled for.',
    tags: ['Change detection', 'Indices'],
  },
  {
    id: 'cross_modal',
    name: 'Monsoon cloud pair',
    sensors: ['S2', 'S1'],
    date: '2024-07-02/03',
    icon: 'fusion',
    type: 'Cross-modal',
    note: 'Optical obscured by cloud. SAR sees through it — the fusion case.',
    tags: ['Fusion', 'SAR'],
  },
]

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/* Readiness is a state, not a measurement, so it gets a lamp and a sentence
   rather than a number slot. "Loading" typeset at 28px next to a count of
   queries reads as a broken metric. */
const BACKEND = {
  ready:    { label: 'Ready',    lamp: '#059669', text: 'text-moss-deep',    note: 'Model loaded and serving' },
  loading:  { label: 'Warming',  lamp: '#D97706', text: 'text-ochre-deep',   note: 'Qwen2.5-VL is still loading' },
  checking: { label: 'Checking', lamp: '#CBD5E1', text: 'text-ink3',         note: 'Contacting the backend' },
  down:     { label: 'Offline',  lamp: '#E11D48', text: 'text-carmine-deep', note: 'No response — check the ngrok URL' },
}

function Lamp({ color, pulse }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: 10, height: 10 }}>
      <span className="block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {pulse && (
        <span className="absolute h-2.5 w-2.5 animate-pulse2 rounded-full"
              style={{ background: color, opacity: 0.5 }} />
      )}
    </span>
  )
}

/* One panel divided by hairlines rather than four separate shadowed boxes —
   these values belong to the same reading, and grouping them says so. */
function Readout({ label, children, foot }) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <div className="mt-1.5">{children}</div>
      {foot && <p className="mt-1 truncate text-[11px] leading-snug text-ink3">{foot}</p>}
    </div>
  )
}

function Figure({ value, tone = 'text-ink' }) {
  return (
    <span className={`font-display text-[24px] font-bold leading-none tabular-nums tracking-tightest ${tone}`}>
      {value}
    </span>
  )
}

/* Both destinations, always on screen. A carousel hid one of the two things
   this page exists to offer behind a swipe. */
function Destination({ icon, title, sub, desc, tags, cta, onClick, motif, primary }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-sheet p-5 text-left
                  transition-shadow duration-200 hover:shadow-lift
                  ${primary ? 'border-primary/35 shadow-sheet' : 'border-rule shadow-sheet'}`}
    >
      <span className="pointer-events-none absolute -right-6 -top-6 opacity-[0.07]" aria-hidden="true">
        {motif}
      </span>

      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white
                          ${primary ? 'bg-primary' : 'bg-accent'}`}>
          <Icon name={icon} size={22} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-[18px] font-bold leading-tight tracking-tightest text-ink">
            {title}
          </h3>
          <p className="truncate text-[12px] text-ink3">{sub}</p>
        </div>
      </div>

      <p className="mt-3.5 flex-1 text-[13px] leading-relaxed text-ink2">{desc}</p>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {tags.map((t) => <span key={t} className="key key-mute">{t}</span>)}
      </div>

      <span className={`mt-4 inline-flex items-center gap-2 self-start rounded border px-3.5 py-2
                        font-display text-[12.5px] font-semibold tracking-tight text-white
                        transition-colors
                        ${primary ? 'border-primary bg-primary group-hover:bg-primary-deep'
                                  : 'border-accent bg-accent group-hover:bg-accent-deep'}`}>
        {cta}
      </span>
    </button>
  )
}

const GridMotif = (
  <svg width="150" height="150" viewBox="0 0 150 150" fill="none" stroke="#0D1B4B" strokeWidth="1">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <g key={i}>
        <line x1={i * 30} y1="0" x2={i * 30} y2="150" />
        <line x1="0" y1={i * 30} x2="150" y2={i * 30} />
      </g>
    ))}
    <rect x="30" y="60" width="60" height="45" strokeWidth="2" />
  </svg>
)

const RingMotif = (
  <svg width="150" height="150" viewBox="0 0 150 150" fill="none" stroke="#2563EB" strokeWidth="1.5">
    {[22, 38, 54, 70].map((r) => <circle key={r} cx="75" cy="75" r={r} />)}
    <circle cx="75" cy="75" r="9" fill="#2563EB" stroke="none" />
  </svg>
)

function HistoryRow({ entry }) {
  const conf = entry.abstained ? null : Math.round(entry.confidence * 100)
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-wash">
      <span className={`h-2 w-2 shrink-0 rounded-sm ${
        entry.abstained ? 'bg-carmine' : entry.confidence >= 0.75 ? 'bg-primary' : 'bg-ochre'}`} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{entry.query}</span>
      <span className="readout hidden shrink-0 text-ink3 sm:inline">{entry.task}</span>
      <span className={`readout shrink-0 font-semibold ${
        entry.abstained ? 'text-carmine-deep' : entry.confidence >= 0.75 ? 'text-primary-deep' : 'text-ochre-deep'}`}>
        {entry.abstained ? 'abstained' : `${conf}%`}
      </span>
    </li>
  )
}

function SectionHead({ title, note }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h3 className="font-display text-[14px] font-semibold tracking-tightest text-ink">{title}</h3>
      <span className="h-px flex-1 bg-rule" />
      {note && <span className="readout shrink-0 text-ink3">{note}</span>}
    </div>
  )
}

export default function DashboardView({ session, backend, history, onOpen, onLoadSet }) {
  // Merge in-session history (React state) with backend-stored history (SQLite).
  // Backend history is fetched once on mount — it covers persisted queries from
  // previous sessions. In-session history arrives live via the history prop.
  const [backendHistory, setBackendHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(!MOCK)

  useEffect(() => {
    if (MOCK || !session?.session_id) {
      setHistoryLoading(false)
      return
    }
    setHistoryLoading(true)
    fetchHistory(session.session_id)
      .then((rows) => setBackendHistory(rows))
      .catch(() => setBackendHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [session?.session_id])

  const allHistory = backendHistory.length > 0 ? backendHistory.map((r) => ({
    query:      r.query,
    task:       r.task,
    confidence: r.confidence,
    abstained:  r.abstained,
  })) : history

  const answered = allHistory.filter((h) => !h.abstained).length
  const avg = allHistory.length
    ? (allHistory.reduce((a, h) => a + h.confidence, 0) / allHistory.length).toFixed(2)
    : '—'

  const be = BACKEND[backend] ?? BACKEND.checking
  const avgTone = avg === '—' || historyLoading
    ? 'text-ink3'
    : parseFloat(avg) >= 0.75 ? 'text-primary-deep' : 'text-ochre-deep'

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-7">

        {/* ── Header band ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="key key-mute">Session {session.session_id}</span>
              {MOCK && <span className="key key-ochre">mock data</span>}
            </div>
            <h2 className="mt-2.5 font-display text-[27px] font-bold leading-tight tracking-tightest text-ink">
              Good to go, {session.name}.
            </h2>
            <p className="mt-1 text-[13px] text-ink2">
              Started {fmtDate(session.started)} · {session.org}
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg border border-rule bg-sheet px-3.5 py-2.5">
            <Lamp color={be.lamp} pulse={backend === 'loading' || backend === 'checking'} />
            <div>
              <p className={`text-[13px] font-semibold leading-none ${be.text}`}>{be.label}</p>
              <p className="mt-1 text-[11px] leading-none text-ink3">{be.note}</p>
            </div>
          </div>
        </div>

        {/* ── Readout strip ────────────────────────────────────────────── */}
        <div className="mt-5 grid grid-cols-2 divide-x divide-y divide-rule overflow-hidden
                        rounded-lg border border-rule bg-sheet shadow-sheet
                        sm:grid-cols-4 sm:divide-y-0">
          <Readout label="Model"
                   foot={MOCK ? 'Mock data — no Colab needed' : 'Qwen2.5-VL-7B · 4-bit'}>
            <span className={`font-display text-[17px] font-bold leading-none tracking-tightest ${be.text}`}>
              {be.label}
            </span>
          </Readout>

          <Readout label="Queries this session"
                   foot={historyLoading ? 'Loading…' : `${answered} answered`}>
            <Figure value={historyLoading ? '·' : allHistory.length} />
          </Readout>

          <Readout label="Mean confidence" foot="Across answered queries">
            <Figure value={historyLoading ? '·' : avg} tone={avgTone} />
          </Readout>

          <Readout label="Tool registry" foot="vqa · grounding · indices · fusion · change">
            <span className="flex items-baseline gap-1.5">
              <Figure value="5" tone="text-moss-deep" />
              <span className="text-[12px] text-ink3">registered</span>
            </span>
          </Readout>
        </div>

        {/* ── Where to go ──────────────────────────────────────────────── */}
        <div className="mt-7 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Destination
            primary
            icon="workspace"
            title="Analyst Workspace"
            sub="Map, layers, execution trace, export"
            desc="Upload GeoTIFFs, run tools and inspect every overlay against the basemap. Use this when the evidence itself is the point — the trace fills in stage by stage and boxes export as GeoJSON in lat/lon."
            tags={['Map view', 'Layer overlays', 'GeoJSON export', 'Execution trace']}
            cta="Open Workspace"
            motif={GridMotif}
            onClick={() => onOpen('analyst')}
          />
          <Destination
            icon="orb"
            title="AI Mode"
            sub="Voice and text, results as cards"
            desc="Ask out loud and watch the router pick its tools. Results fan out as cards you can push back onto the map. Use this when you want to show someone how the system decides."
            tags={['Voice input', 'Tool routing', 'Result cards']}
            cta="Open AI Mode"
            motif={RingMotif}
            onClick={() => onOpen('orb')}
          />
        </div>

        {/* ── Scene library ────────────────────────────────────────────── */}
        <div className="mt-8">
          <SectionHead title="Scene library" note="3 curated sets" />

          <div className="mt-3.5 grid gap-4 lg:grid-cols-3">
            {SCENE_SETS.map((s) => (
              <div key={s.id}
                   className="group flex flex-col rounded-xl border border-rule bg-sheet p-4 shadow-sheet
                              transition-shadow duration-200 hover:shadow-lift">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-wash text-ink2">
                      <Icon name={s.icon} size={15} />
                    </span>
                    <span className="readout text-ink3">{s.type}</span>
                  </div>
                  <span className="readout text-ink3">{s.date}</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.sensors.map((sen, i) => (
                    <span key={i} className={`key ${sen === 'S1' ? 'key-ochre' : 'key-primary'}`}>{sen}</span>
                  ))}
                </div>

                <p className="mt-2.5 font-display text-[15px] font-semibold tracking-tightest text-ink">
                  {s.name}
                </p>
                <p className="mt-1 flex-1 text-[12px] leading-relaxed text-ink2">{s.note}</p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {s.tags.map((tag) => <span key={tag} className="key key-mute">{tag}</span>)}
                </div>

                <button onClick={() => onLoadSet(s.id)} className="btn btn-primary mt-4 w-full">
                  <Icon name="workspace" size={13} />
                  Load into workspace
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent queries ───────────────────────────────────────────── */}
        <div className="mt-8 pb-8">
          <SectionHead title="Recent queries"
                       note={!historyLoading && allHistory.length > 0 ? `${allHistory.length} total` : null} />

          {historyLoading ? (
            <div className="mt-3.5 flex flex-col items-center rounded-xl border border-dashed border-rule2
                            bg-sheet px-6 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-wash text-ink3">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink2">Loading session history…</p>
            </div>
          ) : allHistory.length === 0 ? (
            <div className="mt-3.5 flex flex-col items-center rounded-xl border border-dashed border-rule2
                            bg-sheet px-6 py-11 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-wash text-ink3">
                <Icon name="vqa" size={22} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink2">Nothing run yet</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-ink3">
                Load a scene above, then ask a question. Every query lands here with its
                confidence and the tools that produced it.
              </p>
            </div>
          ) : (
            <ul className="mt-3.5 divide-y divide-rule overflow-hidden rounded-xl border border-rule
                           bg-sheet shadow-sheet">
              {allHistory.slice().reverse().map((h, i) => <HistoryRow key={i} entry={h} />)}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
