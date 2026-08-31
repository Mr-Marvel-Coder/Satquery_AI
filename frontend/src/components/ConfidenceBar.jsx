/**
 * Confidence never ships as a bare number. The PS asks the system to "estimate
 * confidence"; a figure without its basis is not an estimate, it is decoration.
 */
export default function ConfidenceBar({ value, basis, abstained }) {
  if (value == null) return null

  const pct = Math.round(value * 100)
  const tone = abstained ? 'carmine' : value >= 0.75 ? 'primary' : 'ochre'
  const bar = { primary: 'bg-primary', ochre: 'bg-ochre', carmine: 'bg-carmine' }[tone]
  const txt = { primary: 'text-primary-deep', ochre: 'text-ochre-deep', carmine: 'text-carmine-deep' }[tone]

  return (
    <div className="border-t border-rule bg-wash px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="eyebrow">{abstained ? 'Abstained' : 'Confidence'}</span>
        <span className={`ml-auto font-display text-[15px] font-bold tabular-nums ${txt}`}>{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
        <div className={`h-full rounded-full ${bar} transition-[width] duration-700 ease-out`}
             style={{ width: `${pct}%` }} />
      </div>
      <p className={`mt-2 readout ${txt}`}>{basis}</p>
      {abstained && (
        <p className="mt-2 readout leading-relaxed text-carmine-deep">
          Below the 0.35 answer threshold. Reported as insufficient evidence rather than guessed.
        </p>
      )}
    </div>
  )
}
