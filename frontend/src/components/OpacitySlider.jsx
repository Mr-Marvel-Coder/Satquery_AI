/**
 * Sits on the map, not in a settings drawer, because the cross-modal close
 * depends on sliding it live: cloud fades, SAR reveals water. A demo instrument
 * stays under the presenter's thumb.
 */
const KEY = { primary: 'key-primary', ochre: 'key-ochre', carmine: 'key-carmine', moss: 'key-moss' }

export default function OpacitySlider({ value, onChange, layers, active, onActive }) {
  return (
    <div className="pointer-events-auto absolute bottom-9 left-3 right-3 z-[500] rounded border
                    border-rule bg-sheet/94 px-3 py-2.5 shadow-sheet backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow">Layers</span>
        {layers.length === 0 && <span className="readout text-ink3">base only</span>}
        {layers.map((l) => (
          <button key={l.id} onClick={() => onActive(l.id)}
                  className={`key transition-opacity ${active.includes(l.id)
                    ? KEY[l.kind] || 'key-primary' : 'key-mute opacity-60'}`}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <span className="eyebrow shrink-0">Overlay</span>
        <input type="range" min="0" max="100" value={Math.round(value * 100)}
               onChange={(e) => onChange(Number(e.target.value) / 100)}
               aria-label="Overlay opacity"
               className="h-1 w-full appearance-none rounded-full bg-rule accent-primary
                          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                          [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sheet
                          [&::-webkit-slider-thumb]:cursor-grab" />
        <span className="readout w-9 shrink-0 text-right text-ink3">{Math.round(value * 100)}%</span>
      </div>
    </div>
  )
}
