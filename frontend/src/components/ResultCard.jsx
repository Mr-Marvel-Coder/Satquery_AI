import Icon from './Icon.jsx'

/**
 * One card per tool result. Each tool emits a different shape — prose, a box, a
 * mask plus statistics, joint labels, polygons — so each gets a card sized to
 * what it actually produced rather than a uniform slot.
 */
const TINT = {
  primary:    { bar: 'bg-primary',    text: 'text-primary-deep',    head: 'bg-primary-soft'    },
  ochre:   { bar: 'bg-ochre',   text: 'text-ochre-deep',   head: 'bg-ochre-soft'   },
  carmine: { bar: 'bg-carmine', text: 'text-carmine-deep', head: 'bg-carmine-soft' },
  moss:    { bar: 'bg-moss',    text: 'text-moss-deep',    head: 'bg-moss-soft'    },
}

export default function ResultCard({ title, kind = 'primary', runtime, onClose, style, delay = 0, children }) {
  const t = TINT[kind] || TINT.primary
  return (
    <div
      style={{ ...style, animationDelay: `${delay}ms` }}
      className="pointer-events-auto absolute animate-fanin overflow-hidden rounded border
                 border-rule bg-sheet shadow-lift"
    >
      <header className={`flex items-center gap-2 border-b border-rule ${t.head} px-3 py-2`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${t.bar}`} />
        <span className={`font-mono text-[10px] font-medium uppercase tracking-eyebrow ${t.text}`}>
          {title}
        </span>
        {runtime != null && <span className="readout ml-auto text-ink3">{runtime}ms</span>}
        {onClose && (
          <button onClick={onClose} aria-label={`Close ${title}`}
                  className={`${runtime != null ? 'ml-1' : 'ml-auto'} rounded p-0.5 text-ink3
                              transition-colors hover:bg-sheet hover:text-ink`}>
            <Icon name="close" size={12} strokeWidth={2} />
          </button>
        )}
      </header>
      <div className="max-h-[42vh] overflow-y-auto px-3.5 py-3">{children}</div>
    </div>
  )
}
