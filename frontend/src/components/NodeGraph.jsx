/**
 * The connector web. Left column is what was loaded, right column is the tool
 * registry, the orb in the middle is the router.
 *
 * Not decoration: when the router picks a tool, that tool's line inks in and a
 * pulse travels along it toward the orb, in execution order. The PS asks the
 * system to select AND SEQUENCE — here the sequence is drawn, and each chosen
 * tool carries the step number it ran at, so the order is readable from across
 * a room rather than inferred from animation timing alone.
 */
const TINT = {
  primary: '#2563EB',
  ochre:   '#D97706',
  carmine: '#E11D48',
  moss:    '#059669',
  idle:    '#CBD5E1',
}
const SOFT = {
  primary: '#EFF5FF', ochre: '#FEF6E3', carmine: '#FFF0F2', moss: '#E9FBF3', idle: '#FFFFFF',
}
const DEEP = {
  primary: '#1D4ED8', ochre: '#92400E', carmine: '#9F1239', moss: '#065F46', idle: '#64748B',
}

const MONO = "'JetBrains Mono','IBM Plex Mono',monospace"
const NODE_W = 172
const NODE_H = 44

function curve(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.55
  const c1 = x1 < x2 ? x1 + dx : x1 - dx
  const c2 = x1 < x2 ? x2 - dx : x2 + dx
  return `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`
}

function Node({ x, y, label, sub, kind, live, side, rank }) {
  const anchor = side === 'left' ? x - NODE_W : x
  const tint = TINT[kind] || TINT.idle
  const deep = DEEP[kind] || DEEP.idle
  const top = y - NODE_H / 2

  return (
    <g style={{ transition: 'opacity 300ms ease' }}>
      {live && (
        <rect x={anchor - 1} y={top - 1} width={NODE_W + 2} height={NODE_H + 2} rx={9}
              fill="none" stroke={tint} strokeWidth="3" opacity="0.16" filter="url(#ng-glow)" />
      )}

      <rect
        x={anchor} y={top} width={NODE_W} height={NODE_H} rx={8}
        fill={live ? SOFT[kind] || '#FFFFFF' : '#FFFFFF'}
        stroke={live ? tint : '#E2E8F0'}
        strokeWidth={live ? 1.5 : 1}
      />

      {/* The accent bar sits on the side the signal leaves from, so the row
          reads in the direction the data actually travels. */}
      <rect
        x={side === 'left' ? anchor + NODE_W - 3 : anchor}
        y={top + 8} width={3} height={NODE_H - 16} rx={1.5}
        fill={live ? tint : '#E2E8F0'}
      />

      <text
        x={anchor + NODE_W / 2} y={sub ? y - 2 : y + 4} textAnchor="middle"
        fontFamily={MONO} fontSize="10.5" fontWeight="600" letterSpacing="1.1"
        fill={live ? deep : '#64748B'}
      >
        {label.toUpperCase()}
      </text>
      {sub && (
        <text x={anchor + NODE_W / 2} y={y + 11} textAnchor="middle"
              fontFamily={MONO} fontSize="8.5" letterSpacing="0.3"
              fill={live ? tint : '#94A3B8'}>
          {sub}
        </text>
      )}

      {/* Execution order. Only drawn when the tool actually ran, because a
          number on an unused tool would imply a sequence that never happened. */}
      {live && rank != null && (
        <g>
          <circle cx={side === 'left' ? anchor - 13 : anchor + NODE_W + 13} cy={y} r={10}
                  fill={tint} />
          <text x={side === 'left' ? anchor - 13 : anchor + NODE_W + 13} y={y + 3.4}
                textAnchor="middle" fontFamily={MONO} fontSize="9.5" fontWeight="700"
                fill="#FFFFFF">
            {rank + 1}
          </text>
        </g>
      )}
    </g>
  )
}

export default function NodeGraph({ inputs, tools, activeTools, cx, cy, width = 1200, height = 640 }) {
  const leftX = 196
  const rightX = width - 196
  const spread = (n, i) => height / 2 + (i - (n - 1) / 2) * Math.min(82, (height - 170) / Math.max(n, 1))

  return (
    <svg width={width} height={height} className="pointer-events-none absolute inset-0">
      <defs>
        <filter id="ng-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <pattern id="ng-grid" width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#0D1B4B" opacity="0.055" />
        </pattern>
        <radialGradient id="ng-vignette" cx="50%" cy="50%" r="52%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Survey-grid ground. Faint enough to read as paper texture, present
          enough that the stage isn't an empty white void. */}
      <rect width={width} height={height} fill="url(#ng-grid)" />
      <circle cx={cx} cy={cy} r={Math.min(width, height) * 0.42} fill="url(#ng-vignette)" />

      {inputs.map((n, i) => {
        const y = spread(inputs.length, i)
        const tint = n.live ? TINT[n.kind] || TINT.idle : TINT.idle
        return (
          <g key={`ei-${n.id}`}>
            <path d={curve(leftX, y, cx, cy)} fill="none" stroke={tint}
                  strokeWidth={n.live ? 1.4 : 1} opacity={n.live ? 0.55 : 0.4} />
            {n.live && (
              <path d={curve(leftX, y, cx, cy)} fill="none" stroke={tint}
                    strokeWidth="2.2" strokeLinecap="round" strokeDasharray="18 260"
                    opacity="0.75" className="animate-travel"
                    style={{ animationDelay: `${i * 0.3}s`, animationDirection: 'reverse' }} />
            )}
          </g>
        )
      })}

      {tools.map((n, i) => {
        const y = spread(tools.length, i)
        const rank = activeTools.indexOf(n.id)
        const live = rank !== -1
        const tint = TINT[n.kind] || TINT.idle
        return (
          <g key={`et-${n.id}`}>
            <path d={curve(cx, cy, rightX, y)} fill="none"
                  stroke={live ? tint : TINT.idle} strokeWidth={live ? 1.4 : 1}
                  opacity={live ? 0.55 : 0.4} />
            {live && (
              <>
                <path d={curve(cx, cy, rightX, y)} fill="none" stroke={tint}
                      strokeWidth="3.4" strokeLinecap="round" strokeDasharray="24 216"
                      opacity="0.28" filter="url(#ng-glow)"
                      className="animate-travel" style={{ animationDelay: `${rank * 0.22}s` }} />
                <path d={curve(cx, cy, rightX, y)} fill="none" stroke={tint}
                      strokeWidth="2.6" strokeLinecap="round" strokeDasharray="24 216"
                      className="animate-travel" style={{ animationDelay: `${rank * 0.22}s` }} />
              </>
            )}
          </g>
        )
      })}

      {inputs.map((n, i) => (
        <Node key={n.id} side="left" x={leftX} y={spread(inputs.length, i)}
              label={n.label} sub={n.sub} kind={n.kind} live={n.live} />
      ))}
      {tools.map((n, i) => {
        const rank = activeTools.indexOf(n.id)
        return (
          <Node key={n.id} side="right" x={rightX} y={spread(tools.length, i)}
                label={n.label} sub={n.sub} kind={n.kind}
                live={rank !== -1} rank={rank === -1 ? null : rank} />
        )
      })}
    </svg>
  )
}
