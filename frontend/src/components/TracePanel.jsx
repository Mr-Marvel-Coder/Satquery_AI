import Icon from './Icon.jsx'

/**
 * The PS asks for an "auditable execution summary". Most builds render that as a
 * collapsed log at the foot of the page. Here it is a survey traverse: numbered
 * stations down a chain line, arriving one at a time, so "select AND SEQUENCE"
 * is visible as physical vertical order rather than claimed in prose.
 */
const TONE = {
  running: { line: 'bg-ochre',   dot: 'bg-ochre',   text: 'text-ochre-deep'   },
  done:    { line: 'bg-primary',    dot: 'bg-primary',    text: 'text-primary-deep'    },
  abstain: { line: 'bg-carmine', dot: 'bg-carmine', text: 'text-carmine-deep' },
}

function Step({ s, tone, isLast }) {
  const t = TONE[tone]
  return (
    <li className="relative animate-rise pb-5 pl-8">
      {!isLast && <span className={`absolute left-[7px] top-5 bottom-0 w-px ${t.line} opacity-30`} />}
      <span className={`absolute left-0 top-1.5 grid h-[15px] w-[15px] place-items-center rounded-full
                        border-2 border-white ${t.dot} ${tone === 'running' ? 'animate-pulse2' : ''}`}>
        {tone === 'done' && <Icon name="check" size={8} strokeWidth={3.5} className="text-white" />}
      </span>

      <div className="flex items-baseline gap-2">
        <span className="readout text-ink3">{String(s.step).padStart(2, '0')}</span>
        <span className="font-display text-[13px] font-semibold tracking-tight">{s.label}</span>
        <span className="readout text-ink3">{s.tool}@{s.version}</span>
        <span className="readout ml-auto text-ink3">{s.runtime_ms}ms</span>
      </div>
      <p className="mt-1 readout leading-relaxed text-ink2">{s.detail}</p>
      {s.confidence_basis && (
        <p className={`mt-1 readout ${t.text}`}>{s.confidence.toFixed(2)} · {s.confidence_basis}</p>
      )}
    </li>
  )
}

export default function TracePanel({ steps, task, running, abstained, onDownload }) {
  const total = steps.reduce((a, s) => a + s.runtime_ms, 0)

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded border border-rule bg-sheet shadow-sheet">
      <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
        <Icon name="route" size={15} className="text-ink3" />
        <span className="eyebrow">Execution trace</span>
        {running && <span className="readout animate-pulse2 text-ochre-deep">running</span>}
        {!running && steps.length > 0 && <span className="readout text-ink3">{total}ms</span>}
        <button onClick={onDownload} disabled={!steps.length || running}
                className="ml-auto rounded p-1 text-ink3 transition-colors hover:bg-wash hover:text-primary
                           disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Export trace as JSON">
          <Icon name="download" size={15} />
        </button>
      </header>

      {task && (
        <div className="border-b border-rule bg-wash px-4 py-2.5">
          <span className="eyebrow">Interpreted as</span>
          <p className="readout mt-1 text-ink">{task}</p>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {steps.length === 0 ? (
          <p className="readout leading-relaxed text-ink3">
            No steps yet. Every tool the router selects appears here in the order it ran, with its
            runtime and the basis for its confidence.
          </p>
        ) : (
          <ol>
            {steps.map((s, i) => {
              const last = i === steps.length - 1
              const tone = abstained ? 'abstain' : (running && last ? 'running' : 'done')
              return <Step key={s.step} s={s} tone={tone} isLast={last} />
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
