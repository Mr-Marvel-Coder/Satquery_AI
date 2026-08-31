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

// Format a date string nicely
function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

// Backend status config
const BACKEND_CONFIG = {
  ready:    { label: 'Ready',     dotClass: 'bg-moss',    textClass: 'text-moss-deep',    borderClass: 'border-l-moss' },
  loading:  { label: 'Loading',   dotClass: 'bg-ochre',   textClass: 'text-ochre-deep',   borderClass: 'border-l-ochre' },
  checking: { label: 'Checking',  dotClass: 'bg-rule2',   textClass: 'text-ink3',         borderClass: 'border-l-rule2' },
  down:     { label: 'Down',      dotClass: 'bg-carmine', textClass: 'text-carmine-deep', borderClass: 'border-l-carmine' },
}

/** Modern metric card */
function MetricCard({ icon, label, value, sub, tone = 'text-ink', accentBorder = 'border-l-primary', iconBg = 'bg-primary-soft', iconColor = 'text-primary' }) {
  return (
    <div className={`group relative overflow-hidden rounded-lg border border-rule border-l-2 bg-sheet px-4 py-4 shadow-sheet
                     transition-all duration-300 hover:-translate-y-1 hover:shadow-lift
                     ${accentBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{label}</p>
          <p className={`mt-2 font-display text-[28px] font-bold leading-none tabular-nums tracking-tightest ${tone}`}>
            {value}
          </p>
          {sub && <p className="mt-1.5 text-[11px] leading-snug text-ink3 transition-colors group-hover:text-ink2">{sub}</p>}
        </div>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${iconBg} ${iconColor}`}>
          <Icon name={icon} size={17} />
        </span>
      </div>
    </div>
  )
}

/** Query history row */
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

export default function DashboardView({ session, backend, history, onOpen, onLoadSet }) {
  // Merge in-session history (from React state) with backend-stored history (from SQLite).
  // Backend history is fetched once on mount — it covers queries from previous sessions
  // that were persisted. In-session history comes in via the history prop (live queries).
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

  // Use backend history when available, fall back to in-session history
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

  const beCfg = BACKEND_CONFIG[backend] ?? BACKEND_CONFIG.checking
  const [activeSlide, setActiveSlide] = useState(0)
  const slides = [
    {
      id: 'analyst',
      title: 'Analyst Workspace',
      sub: 'Map · Layers · Trace · Export',
      desc: 'Upload GeoTIFFs, run tools, inspect overlays and export GeoJSON. Use this when you need to see the evidence layer by layer.',
      tags: ['Map view', 'Layer overlays', 'GeoJSON export', 'Execution trace'],
      tagColor: 'key-mute',
      icon: 'workspace',
      colorName: 'primary'
    },
    {
      id: 'orb',
      title: 'AI Mode',
      sub: 'Voice · Text · 10 Indian languages',
      desc: 'The router selects tools automatically and fans results as cards. Use this when you want to show someone how the system thinks.',
      tags: ['Voice input', 'Text input', 'Multi-language', 'Tool routing'],
      tagColor: 'key-ochre',
      icon: 'orb',
      colorName: 'ochre'
    }
  ]
  const currentSlide = slides[activeSlide]

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* ── Welcome section ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="key key-mute">Session {session.session_id}</span>
            <h2 className="mt-2.5 font-display text-[26px] font-bold leading-tight tracking-tightest text-ink">
              Good to go, {session.name}.
            </h2>
            <p className="mt-1 text-[13px] text-ink2">
              Started {fmtDate(session.started)} · {session.org}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:pb-0.5">
            <span className={`h-2 w-2 rounded-full ${beCfg.dotClass}`} />
            <span className={`text-[12px] font-medium ${beCfg.textClass}`}>{beCfg.label}</span>
            {MOCK && <span className="key key-ochre">mock data</span>}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-6 border-t border-rule" />

        {/* ── Primary action carousel ──────────────────────────────────────── */}
        <div className="mt-8">
          <div className="relative overflow-hidden rounded-2xl border border-rule bg-sheet shadow-sheet transition-all hover:shadow-lift group">
            {/* Background graphic */}
            <span className={`pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-40 transition-colors duration-500
                             ${currentSlide.colorName === 'primary' ? 'bg-primary-soft' : 'bg-ochre-soft'}`} />
            
            <div className="relative p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <span className={`grid h-14 w-14 place-items-center rounded-xl text-white shadow-md transition-colors duration-500
                                   ${currentSlide.colorName === 'primary' ? 'bg-primary' : 'bg-ochre'}`}>
                    <Icon name={currentSlide.icon} size={28} />
                  </span>
                  <div>
                    <h3 className="font-display text-[22px] font-bold tracking-tight text-ink transition-colors">
                      {currentSlide.title}
                    </h3>
                    <p className="text-[13px] text-ink3">{currentSlide.sub}</p>
                  </div>
                </div>
                <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink2">
                  {currentSlide.desc}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {currentSlide.tags.map((t) => (
                    <span key={t} className={`key px-2 py-1 ${currentSlide.tagColor}`}>{t}</span>
                  ))}
                </div>
              </div>

              <div className="shrink-0 w-full md:w-auto flex flex-col items-center md:items-end gap-4 border-t border-rule md:border-t-0 pt-6 md:pt-0">
                <button
                  onClick={() => onOpen(currentSlide.id)}
                  className={`btn px-8 py-3 text-[14px] shadow-sm text-white transition-colors
                              ${currentSlide.colorName === 'primary' ? 'bg-primary border-primary hover:bg-primary-deep' : 'bg-ochre border-ochre hover:bg-ochre-deep'}`}
                >
                  Launch {currentSlide.title.split(' ')[1]}
                </button>
              </div>
            </div>

            {/* Pagination Controls */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${activeSlide === idx ? 'w-6 bg-ink2' : 'w-2 bg-rule2 hover:bg-ink3'}`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
            
            {/* Arrow Controls (visible on hover) */}
            <button 
              onClick={() => setActiveSlide((s) => (s === 0 ? 1 : 0))}
              className="absolute left-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-white border border-rule shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:border-primary hover:text-primary text-ink3"
            >
              <Icon name="chevron" size={14} className="rotate-90" />
            </button>
            <button 
              onClick={() => setActiveSlide((s) => (s === 0 ? 1 : 0))}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-white border border-rule shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:border-primary hover:text-primary text-ink3"
            >
              <Icon name="chevron" size={14} className="-rotate-90" />
            </button>
          </div>
        </div>

        {/* ── System overview ───────────────────────────────────────────── */}
        <div className="mt-8">
          <h3 className="font-display text-[14px] font-semibold tracking-tightest text-ink">
            System overview
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon="satellite"
              label="Backend"
              value={beCfg.label}
              sub={MOCK ? 'Mock data — no Colab needed' : 'Qwen2.5-VL-7B · 4-bit'}
              tone={beCfg.textClass}
              accentBorder={backend === 'ready' ? 'border-l-moss' : backend === 'down' ? 'border-l-carmine' : 'border-l-ochre'}
              iconBg={backend === 'ready' ? 'bg-moss-soft' : backend === 'down' ? 'bg-carmine-soft' : 'bg-ochre-soft'}
              iconColor={backend === 'ready' ? 'text-moss-deep' : backend === 'down' ? 'text-carmine-deep' : 'text-ochre-deep'}
            />
            <MetricCard
              icon="vqa"
              label="Queries this session"
              value={historyLoading ? '...' : allHistory.length}
              sub={historyLoading ? 'Loading...' : `${answered} answered`}
              accentBorder="border-l-primary"
              iconBg="bg-primary-soft"
              iconColor="text-primary"
            />
            <MetricCard
              icon="grounding"
              label="Mean confidence"
              value={historyLoading ? '...' : avg}
              sub="Across answered queries"
              tone={avg === '—' || historyLoading ? 'text-ink3' : parseFloat(avg) >= 0.75 ? 'text-primary-deep' : 'text-ochre-deep'}
              accentBorder={avg === '—' || historyLoading ? 'border-l-rule2' : parseFloat(avg) >= 0.75 ? 'border-l-primary' : 'border-l-ochre'}
              iconBg={avg === '—' || historyLoading ? 'bg-wash' : parseFloat(avg) >= 0.75 ? 'bg-primary-soft' : 'bg-ochre-soft'}
              iconColor={avg === '—' || historyLoading ? 'text-ink3' : parseFloat(avg) >= 0.75 ? 'text-primary' : 'text-ochre'}
            />
            <MetricCard
              icon="route"
              label="Tools registered"
              value="5"
              sub="VQA · Grounding · Indices · Fusion · Change"
              accentBorder="border-l-moss"
              iconBg="bg-moss-soft"
              iconColor="text-moss-deep"
            />
          </div>
        </div>

        {/* ── Scene Library ────────────────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h3 className="font-display text-[14px] font-semibold tracking-tightest text-ink">
                Scene library
              </h3>
              <span className="readout text-ink3">3 curated sets</span>
            </div>
          </div>

          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            {SCENE_SETS.map((s) => (
              <div key={s.id}
                   className="flex flex-col rounded-xl border border-rule bg-sheet p-4 shadow-sheet
                              transition-all hover:shadow-lift">
                {/* Scene header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-wash text-ink3">
                      <Icon name={s.icon} size={15} />
                    </span>
                    <span className="readout text-ink3">{s.type}</span>
                  </div>
                  <span className="readout text-ink3">{s.date}</span>
                </div>

                {/* Sensor badges */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.sensors.map((sen, i) => (
                    <span key={i} className={`key ${sen === 'S1' ? 'key-ochre' : 'key-primary'}`}>{sen}</span>
                  ))}
                </div>

                {/* Name + note */}
                <p className="mt-2.5 font-display text-[14px] font-semibold tracking-tightest text-ink">
                  {s.name}
                </p>
                <p className="mt-1 flex-1 text-[12px] leading-relaxed text-ink2">{s.note}</p>

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.tags.map((tag) => (
                    <span key={tag} className="key key-mute">{tag}</span>
                  ))}
                </div>

                {/* Action */}
                <button
                  onClick={() => onLoadSet(s.id)}
                  className="btn btn-primary mt-4 w-full"
                >
                  <Icon name="workspace" size={13} />
                  Load into workspace
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent queries ───────────────────────────────────────────── */}
        <div className="mt-8 pb-6">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-[14px] font-semibold tracking-tightest text-ink">
              Recent queries
            </h3>
            {!historyLoading && allHistory.length > 0 && (
              <span className="readout text-ink3">{allHistory.length} total</span>
            )}
          </div>

          {historyLoading ? (
            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-rule2
                            bg-sheet px-6 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-wash text-ink3">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink2">Loading session history...</p>
            </div>
          ) : allHistory.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-rule2
                            bg-sheet px-6 py-12 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-wash text-ink3">
                <Icon name="vqa" size={22} />
              </span>
              <p className="mt-3 text-[13px] font-medium text-ink2">No queries yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink3">
                Run a query in Workspace or AI Mode and it will appear here
                with its confidence score and the tools that produced it.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-rule overflow-hidden rounded-xl border border-rule
                           bg-sheet shadow-sheet">
              {allHistory.slice().reverse().map((h, i) => (
                <HistoryRow key={i} entry={h} />
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
