/**
 * A drawn-for-this-product icon set rather than an off-the-shelf one.
 * The glyphs borrow from map marginalia — quad sheets, benchmarks, crosshairs,
 * swath diagrams — so the navigation speaks the same language as the data.
 *
 * All are 24×24, 1.6 stroke, currentColor. Add one by adding a key.
 */
const P = {
  // Mark: a graticule circle with one quadrant surveyed.
  logo: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 3.4v17.2M3.4 12h17.2" />
      <path d="M12 12h8.6A8.6 8.6 0 0 1 12 20.6Z" fill="currentColor" stroke="none" opacity="0.9" />
    </>
  ),
  // Quad sheet, one cell indexed.
  dashboard: (
    <>
      <rect x="3.2" y="3.2" width="7.6" height="7.6" />
      <rect x="13.2" y="3.2" width="7.6" height="7.6" />
      <rect x="3.2" y="13.2" width="7.6" height="7.6" />
      <rect x="13.2" y="13.2" width="7.6" height="7.6" fill="currentColor" stroke="none" opacity="0.85" />
    </>
  ),
  // Stacked map sheets.
  workspace: (
    <>
      <path d="M12 3.6 21 8l-9 4.4L3 8Z" />
      <path d="m3 12.4 9 4.4 9-4.4" />
      <path d="m3 16.6 9 4.4 9-4.4" opacity="0.55" />
    </>
  ),
  // The orb.
  orb: (
    <>
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6" opacity="0.8" />
      <circle cx="12" cy="12" r="9.4" strokeDasharray="2.6 3" opacity="0.55" />
    </>
  ),
  // Sheet entering the workspace.
  upload: (
    <>
      <path d="M12 15.6V4.4M8.4 8l3.6-3.6L15.6 8" />
      <path d="M4.4 14.6v3.4a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6v-3.4" />
    </>
  ),
  // Globe graticule.
  globe: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8.6" />
      <path d="M3.7 9.2h16.6M3.7 14.8h16.6" />
    </>
  ),
  // Survey benchmark.
  grounding: (
    <>
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <path d="M12 2.6v3.4M12 18v3.4M2.6 12H6M18 12h3.4" />
    </>
  ),
  // Framed scene under inspection.
  vqa: (
    <>
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="1" />
      <circle cx="10.6" cy="11.4" r="3.1" />
      <path d="m13 13.8 3.6 3.6" />
    </>
  ),
  // Index histogram.
  indices: (
    <>
      <path d="M3.6 19.6h16.8" />
      <rect x="5.4" y="12.4" width="3.4" height="7.2" />
      <rect x="10.3" y="7.6" width="3.4" height="12" fill="currentColor" stroke="none" opacity="0.8" />
      <rect x="15.2" y="14.6" width="3.4" height="5" />
    </>
  ),
  // Two modalities overlapping.
  fusion: (
    <>
      <circle cx="9.4" cy="12" r="5.6" />
      <circle cx="14.6" cy="12" r="5.6" />
    </>
  ),
  // Bi-temporal offset.
  change: (
    <>
      <rect x="3.2" y="3.2" width="11.2" height="11.2" />
      <rect x="9.6" y="9.6" width="11.2" height="11.2" strokeDasharray="2.8 2.4" />
    </>
  ),
  route: (
    <>
      <circle cx="5.4" cy="6" r="2.2" />
      <circle cx="18.6" cy="18" r="2.2" />
      <path d="M7.6 6h5.6a3.4 3.4 0 0 1 0 6.8H10a3.4 3.4 0 0 0 0 5.2h6.4" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.6 21 8l-9 4.4L3 8Z" />
      <path d="m3 13.4 9 4.4 9-4.4" />
    </>
  ),
  report: (
    <>
      <path d="M6 3.4h7.6L18.6 8v12.6H6Z" />
      <path d="M13.6 3.4V8h5" />
      <path d="M9 12.6h6.4M9 16h4.4" />
    </>
  ),
  mic: (
    <>
      <rect x="9.2" y="2.6" width="5.6" height="11.2" rx="2.8" />
      <path d="M5.4 11.6a6.6 6.6 0 0 0 13.2 0M12 18.2v3.2" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.6v11.2M8.4 11.2 12 14.8l3.6-3.6" />
      <path d="M4.4 18v1.6a1.6 1.6 0 0 0 1.6 1.6h12a1.6 1.6 0 0 0 1.6-1.6V18" />
    </>
  ),
  signout: (
    <>
      <path d="M14.8 16.6 19.4 12l-4.6-4.6M19.4 12H9" />
      <path d="M9.4 3.4H5.6a1.6 1.6 0 0 0-1.6 1.6v14a1.6 1.6 0 0 0 1.6 1.6h3.8" />
    </>
  ),
  chevron: <path d="m9.4 5.6 6.4 6.4-6.4 6.4" />,
  close: <path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4" />,
  check: <path d="m4.8 12.6 4.8 4.8L19.2 7" />,
  north: (
    <>
      <path d="M12 2.6 16 13l-4-2.6L8 13Z" fill="currentColor" stroke="none" />
      <path d="M8.6 21.4v-4.8l3.4 4.8v-4.8" strokeWidth="1.3" />
    </>
  ),

  // ── New icons added for the modernized UI ──────────────────────────────

  // User / profile — single person silhouette.
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.4 20.6c0-4.2 3.4-7.6 7.6-7.6s7.6 3.4 7.6 7.6" />
    </>
  ),

  // Settings — gear / cog.
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.6v2M12 19.4v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.6 12h2M19.4 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4" />
    </>
  ),

  // Bell — notifications.
  bell: (
    <>
      <path d="M18 10.4A6 6 0 0 0 6 10.4v3.2l-2 2.4h16l-2-2.4Z" />
      <path d="M10.2 18.6a1.8 1.8 0 0 0 3.6 0" />
    </>
  ),

  // Satellite — orbital body with solar panels.
  satellite: (
    <>
      <rect x="10" y="9" width="4" height="6" rx="0.6" />
      <path d="M10 11H5.6M14 11h4.4" />
      <rect x="3.4" y="9.8" width="2.2" height="4.4" rx="0.4" />
      <rect x="18.4" y="9.8" width="2.2" height="4.4" rx="0.4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" opacity="0.8" />
    </>
  ),

  // Info — circle with i.
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.6v6M12 7.8v.4" strokeWidth="2" strokeLinecap="round" />
    </>
  ),

  // Shield — security.
  shield: (
    <>
      <path d="M12 2.6 4 6v6c0 5.2 3.6 8.8 8 10 4.4-1.2 8-4.8 8-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),

  // Calendar — date indicator.
  calendar: (
    <>
      <rect x="3.4" y="5.4" width="17.2" height="15.2" rx="1.4" />
      <path d="M3.4 10.6h17.2M8.4 3.4v4M15.6 3.4v4" />
    </>
  ),

  // Arrow up-right — external link / open.
  external: (
    <>
      <path d="M5.6 18.4 18.4 5.6M18.4 5.6H10M18.4 5.6v8.4" />
    </>
  ),
}

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.6, ...rest }) {
  const glyph = P[name]
  if (!glyph) return null
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" {...rest}
    >
      {glyph}
    </svg>
  )
}

/** Wordmark — uses the satquery_logo.png asset.
 *  dark=true  → used in the dark navy sidebar; logo is placed on a semi-transparent
 *               lighter dark-blue card so it always reads clearly against the dark bg.
 *  Expanded: full logo image.
 *  Collapsed: compact square with logo contained inside.
 */
export function Wordmark({ showText = true, dark = false, className = '' }) {
  // Background pill used when on dark sidebar so logo pops regardless of logo's own bg
  const darkPill = dark ? {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: '8px',
    padding: showText ? '5px 10px' : '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } : {}

  if (showText) {
    return (
      <div className={`flex items-center w-full ${className}`}>
        <div style={darkPill}>
          <img
            src="/satquery_logo.png"
            alt="SatQuery"
            style={{ height: '46px', width: 'auto', maxWidth: '200px', objectFit: 'contain', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      </div>
    )
  }

  // Collapsed state — square crop, fits the 72px sidebar
  return (
    <div className={`flex w-full items-center justify-center ${className}`}>
      <div style={darkPill}>
        <img
          src="/satquery_logo.png"
          alt="SatQuery"
          style={{ width: '52px', height: '52px', objectFit: 'contain', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>
    </div>
  )
}
