import { useRef, useState } from 'react'
import { MOCK } from '../api.js'
import Icon from './Icon.jsx'

/** Three input configurations, because the PS defines three. Picking the
 *  configuration up front is what tells the router whether a cross-modal or
 *  bi-temporal path is even legal — so it is a control, not an inference. */
const MODES = [
  { id: 'single',      label: 'Single',      icon: 'globe',  hint: '1 scene · VQA, grounding, indices' },
  { id: 'bitemporal',  label: 'Δ Time',      icon: 'change', hint: '2 dates · change analysis' },
  { id: 'cross_modal', label: 'S2 + S1',     icon: 'fusion', hint: 'optical + SAR · cross-modal fusion' },
]

export default function UploadPanel({ mode, onMode, scenes, validation, busy, onUpload }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  const take = (files) => files.length && onUpload(Array.from(files), mode)
  const active = MODES.find((m) => m.id === mode)

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded border border-rule bg-sheet shadow-sheet">
      <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
        <Icon name="upload" size={15} className="text-ink3" />
        <span className="eyebrow">Input</span>
      </header>

      <div className="grid grid-cols-3 border-b border-rule">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => onMode(m.id)} title={m.hint}
                  className={`flex flex-col items-center gap-1 border-r border-rule py-2.5 last:border-r-0
                              transition-colors ${mode === m.id
                                ? 'bg-primary-soft text-primary-deep' : 'text-ink3 hover:bg-wash hover:text-ink'}`}>
            <Icon name={m.icon} size={16} />
            <span className="font-mono text-[9px] uppercase tracking-eyebrow">{m.label}</span>
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files) }}
        onClick={() => input.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        className={`m-3 cursor-pointer rounded border border-dashed px-4 py-6 text-center transition-colors
                    ${drag ? 'border-primary bg-primary-soft' : 'border-rule2 hover:border-primary hover:bg-wash'}`}>
        <input ref={input} type="file" multiple accept=".tif,.tiff" className="hidden"
               onChange={(e) => take(e.target.files)} />
        <Icon name="upload" size={20} className="mx-auto text-ink3" />
        <p className="mt-2 font-display text-[13px] font-semibold">
          {busy ? 'Reading…' : 'Drop GeoTIFFs'}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink3">{active.hint}</p>
      </div>

      {MOCK && (
        <button onClick={() => onUpload([], mode)} disabled={busy} className="btn btn-primary mx-3 mb-3">
          Load sample scenes
        </button>
      )}

      {scenes.length > 0 && (
        <ul className="border-t border-rule">
          {scenes.map((s) => (
            <li key={s.id} className="border-b border-rule px-4 py-3 last:border-b-0">
              <div className="flex items-center gap-2">
                <span className={`key ${s.sensor === 'S1' ? 'key-ochre' : 'key-primary'}`}>
                  {s.sensor} {s.sensor === 'S1' ? 'SAR' : 'optical'}
                </span>
                <span className="readout ml-auto text-ink3">{s.gsd} m</span>
              </div>
              <p className="mt-2 text-[12px] font-medium">{s.label}</p>
              <p className="mt-0.5 readout text-ink3">{s.crs} · {s.bands.join(' ')}</p>
            </li>
          ))}
        </ul>
      )}

      {validation && (
        <div className={`border-t border-rule px-4 py-3 ${validation.ok ? 'bg-moss-soft/50' : 'bg-carmine-soft'}`}>
          <div className="flex items-center gap-2">
            <span className="eyebrow">Validation</span>
            <span className={`readout ml-auto font-medium ${validation.ok ? 'text-moss-deep' : 'text-carmine-deep'}`}>
              {validation.ok ? 'passed' : 'failed'}
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            {validation.notes.map((n, i) => (
              <li key={i} className="readout text-ink2">— {n}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
