import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'

/**
 * Application sidebar — the map legend for the whole app.
 *
 * Collapsed it is a 76px rail; clicking any empty part of it opens it, and the
 * brand row closes it again. No toggle tab hanging off the edge.
 *
 * Labels stay mounted across the transition and slide behind a clip, so
 * collapsing reads as one object moving rather than a width tween with content
 * popping out of existence.
 *
 * Press [ to toggle.
 */

/* Lighter than the previous panel and built as a real scale. Every text value
   is checked against the panel — the old section label sat near 2.3:1, which is
   why the tool registry was unreadable. */
const C = {
  top:    '#193459',   // panel, lit end
  bottom: '#0C1F3D',   // panel, shadowed end
  crown:  '#0A1830',   // header and footer bands
  raised: '#22447A',   // hover
  active: '#2C5798',   // selected fill
  line:   '#254A82',   // borders
  beam:   '#63B8FF',   // the one bright thing in here
  text:   '#E6EFFA',   // primary labels
  mute:   '#A5BEDB',   // meta and values          ~7.4:1
  dim:    '#87A3C4',   // section headers           ~5.2:1
  idle:   '#3D6299',   // pending marks
}

const NAV = [
  { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { id: 'analyst',   icon: 'workspace', label: 'Workspace' },
  { id: 'orb',       icon: 'orb',       label: 'AI Mode'   },
]

const SCENES = [
  { id: 'single',      icon: 'globe',  label: 'Koyna basin',  meta: '1 · S2'  },
  { id: 'bitemporal',  icon: 'change', label: 'Koyna Δt',     meta: '2 · S2'  },
  { id: 'cross_modal', icon: 'fusion', label: 'Monsoon pair', meta: 'S2 + S1' },
]

const TOOLS = [
  { id: 'vqa',       icon: 'vqa',       label: 'vqa',       dot: '#7DD3FC' },
  { id: 'grounding', icon: 'grounding', label: 'grounding', dot: '#7DD3FC' },
  { id: 'indices',   icon: 'indices',   label: 'indices',   dot: '#6EE7B7' },
  { id: 'fusion',    icon: 'fusion',    label: 'fusion',    dot: '#FCD34D' },
  { id: 'change',    icon: 'change',    label: 'change',    dot: '#FDA4AF' },
]

const EASE = 'cubic-bezier(0.22,0.75,0.24,1)'
const W_OPEN = 252
const W_RAIL = 76

function Label({ open, delay = 0, children, className = '', style = {} }) {
  return (
    <span
      className={`min-w-0 whitespace-nowrap ${className}`}
      style={{
        opacity: open ? 1 : 0,
        transform: open ? 'none' : 'translateX(-8px)',
        transition: `opacity 190ms ${EASE} ${open ? delay : 0}ms, transform 280ms ${EASE} ${open ? delay : 0}ms`,
        pointerEvents: open ? 'auto' : 'none',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

function Tip({ label, open }) {
  if (open) return null
  return (
    <span
      className="pointer-events-none absolute left-full z-50 ml-3 translate-x-[-4px] whitespace-nowrap
                 rounded-md px-2.5 py-1.5 text-[10.5px] uppercase opacity-0 shadow-2xl
                 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100"
      style={{
        background: C.crown, color: C.text, border: `1px solid ${C.line}`,
        letterSpacing: '0.13em', fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      {label}
    </span>
  )
}

function Row({ icon, label, meta, active, open, onClick, dense }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={open ? undefined : label}
      className="group relative flex w-full items-center rounded-lg text-left"
      style={{
        height: dense ? 40 : 46,
        paddingLeft: open ? 13 : 0,
        paddingRight: open ? 11 : 0,
        gap: open ? 11 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        background: active
          ? `linear-gradient(96deg, ${C.active} 0%, rgba(44,87,152,0.55) 100%)`
          : hover ? C.raised : 'transparent',
        color: active ? '#FFFFFF' : hover ? C.text : C.mute,
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px -6px rgba(99,184,255,0.45)'
          : 'none',
        transition: `background 170ms ${EASE}, color 170ms ${EASE}, padding 280ms ${EASE}, gap 280ms ${EASE}, box-shadow 200ms ${EASE}`,
      }}
    >
      <span
        className="absolute left-0 rounded-r-full"
        style={{
          top: 7, bottom: 7, width: 3,
          background: C.beam,
          boxShadow: active ? `0 0 10px ${C.beam}` : 'none',
          opacity: active ? 1 : 0,
          transform: active ? 'scaleY(1)' : 'scaleY(0.25)',
          transition: `opacity 190ms ${EASE}, transform 260ms ${EASE}`,
        }}
      />
      <span
        className="grid shrink-0 place-items-center"
        style={{
          width: 24, height: 24,
          transform: hover && !active ? 'scale(1.09)' : 'scale(1)',
          transition: `transform 200ms ${EASE}`,
        }}
      >
        <Icon name={icon} size={dense ? 20 : 22} />
      </span>
      {open && (
        <>
          <span className="flex-1 truncate"
                style={{ fontSize: dense ? 13.5 : 14.5, fontWeight: active ? 600 : 500, letterSpacing: '-0.012em' }}>
            {label}
          </span>
          {meta && (
            <span className="shrink-0 font-mono"
                  style={{ fontSize: 10.5, color: active ? '#C6E1FF' : C.dim }}>
              {meta}
            </span>
          )}
        </>
      )}
      <Tip label={label} open={open} />
    </button>
  )
}

/* Registered-but-waiting is a real state. A hollow square reads as an unticked
   checkbox and a grey block reads as broken, so idle is a dim filled lozenge
   that brightens and widens when the tool actually runs. */
function ToolRow({ tool, live, open }) {
  return (
    <div
      className="group relative flex items-center rounded-lg"
      style={{
        height: 32,
        paddingLeft: open ? 13 : 0,
        paddingRight: open ? 11 : 0,
        gap: open ? 11 : 0,
        justifyContent: open ? 'flex-start' : 'center',
        transition: `padding 280ms ${EASE}, gap 280ms ${EASE}`,
      }}
    >
      <span className="relative grid shrink-0 place-items-center" style={{ width: 24, height: 24 }}>
        <span
          className="block rounded-full"
          style={{
            width: live ? 16 : 8, height: 4,
            background: live ? tool.dot : C.idle,
            boxShadow: live ? `0 0 9px ${tool.dot}` : 'none',
            transition: `width 320ms ${EASE}, background 220ms ${EASE}, box-shadow 220ms ${EASE}`,
          }}
        />
      </span>
      {open && (
        <>
          <span className="flex-1 truncate font-mono"
                style={{ fontSize: 12, letterSpacing: '0.01em',
                         color: live ? C.text : C.mute, transition: `color 220ms ${EASE}` }}>
            {tool.label}
          </span>
          <span className="shrink-0"
                style={{ color: live ? tool.dot : C.idle, transition: `color 220ms ${EASE}` }}>
            <Icon name={tool.icon} size={13} />
          </span>
        </>
      )}
      <Tip label={tool.label} open={open} />
    </div>
  )
}

function Section({ title, open, children, first }) {
  return (
    <div style={{ padding: first ? '12px 11px 2px' : '6px 11px 2px' }}>
      <div className="relative mb-1.5 flex items-center" style={{ height: 18 }}>
        <span
          className="absolute left-3 right-3 top-1/2"
          style={{
            borderTop: `1px solid ${C.line}`,
            opacity: open ? 0 : 0.8,
            transition: `opacity 180ms ${EASE}`,
          }}
        />
        <Label open={open} className="px-2 font-mono uppercase"
               style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.17em', color: C.dim }}>
          {title}
        </Label>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export default function Sidebar({ view, onView, activeTools = [], sceneSet, onLoadSet, session, onSignOut, onProfile }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('satquery.sidebar') !== 'closed' } catch { return true }
  })
  const [brandHover, setBrandHover] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('satquery.sidebar', open ? 'open' : 'closed') } catch {}
  }, [open])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
      if (t && t.isContentEditable) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Clicking bare rail opens it. Clicks that land on a control are that
     control's business, so navigating from the rail doesn't force it open. */
  const onAsideClick = (e) => {
    if (open) return
    if (e.target.closest('button')) return
    setOpen(true)
  }

  return (
    <aside
      onClick={onAsideClick}
      className="relative z-30 flex h-full shrink-0 flex-col"
      style={{
        width: open ? W_OPEN : W_RAIL,
        cursor: open ? 'default' : 'e-resize',
        transition: `width 320ms ${EASE}`,
        /* Dot grid over the gradient — enough texture to stop it reading as a
           flat slab, faint enough that it never competes with the labels. */
        backgroundImage: `
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0),
          radial-gradient(120% 70% at 50% -10%, rgba(99,184,255,0.13) 0%, transparent 62%),
          linear-gradient(176deg, ${C.top} 0%, ${C.bottom} 70%, ${C.crown} 100%)
        `,
        backgroundSize: '22px 22px, 100% 100%, 100% 100%',
        borderRight: `1px solid ${C.line}`,
        boxShadow: 'inset -14px 0 30px -26px rgba(0,0,0,0.95)',
      }}
    >
      {/* Brand — also the close control when open */}
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setBrandHover(true)}
        onMouseLeave={() => setBrandHover(false)}
        title={open ? 'Collapse sidebar  [' : 'Expand sidebar  ['}
        className="relative flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          height: 80,
          borderBottom: `1px solid ${C.line}`,
          background: brandHover ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
          transition: `background 170ms ${EASE}`,
        }}
      >
        <div
          className="grid place-items-center"
          style={{
            width: open ? 180 : 54,
            height: open ? 54 : 54,
            transition: `width 320ms ${EASE}, height 320ms ${EASE}`,
          }}
        >
          <img src="/satquery_logo.png" alt="SatQuery Logo"
               style={{
                 width: '100%', height: '100%', objectFit: 'contain',
                 transform: brandHover ? 'scale(1.05)' : 'scale(1)',
                 transition: `transform 200ms ${EASE}`
               }} />
        </div>
      </button>

      {/* Body */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3"
           style={{ scrollbarWidth: 'none' }}>
        <Section title="Navigate" open={open} first>
          {NAV.map((n) => (
            <Row key={n.id} icon={n.icon} label={n.label}
                 open={open} active={view === n.id} onClick={() => onView(n.id)} />
          ))}
        </Section>

        <Section title="Scene library" open={open}>
          {SCENES.map((s) => (
            <Row key={s.id} icon={s.icon} label={s.label} meta={s.meta} dense
                 open={open} active={sceneSet === s.id} onClick={() => onLoadSet(s.id)} />
          ))}
        </Section>

        <Section title="Tool registry" open={open}>
          {TOOLS.map((t) => (
            <ToolRow key={t.id} tool={t} live={activeTools.includes(t.id)} open={open} />
          ))}
        </Section>
      </nav>

      {/* Footer */}
      <div
        className="flex shrink-0 items-center overflow-hidden"
        style={{
          gap: open ? 11 : 0,
          height: 64,
          paddingLeft: open ? 15 : 0,
          paddingRight: open ? 11 : 0,
          justifyContent: open ? 'flex-start' : 'center',
          borderTop: `1px solid ${C.line}`,
          background: 'rgba(0,0,0,0.26)',
          transition: `padding 280ms ${EASE}, gap 280ms ${EASE}`,
        }}
      >
        <button
          onClick={onProfile}
          aria-label="Profile"
          title={open ? undefined : session.name}
          className="grid shrink-0 place-items-center rounded-full font-display font-bold"
          style={{
            width: 34, height: 34, fontSize: 13,
            background: `linear-gradient(140deg, ${C.active}, ${C.raised})`,
            color: '#FFFFFF',
            border: `1.5px solid ${C.line}`,
            transition: `border-color 180ms ${EASE}, box-shadow 220ms ${EASE}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = C.beam
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,184,255,0.16)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = C.line
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          {session.name.slice(0, 1).toUpperCase()}
        </button>

        {open && (
          <>
            <div className="min-w-0 flex-1">
              <button onClick={onProfile} className="block w-full min-w-0 text-left">
                <span className="block truncate leading-tight"
                      style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>
                  {session.name}
                </span>
                <span className="block truncate font-mono" style={{ fontSize: 10, color: C.dim }}>
                  {session.role}
                </span>
              </button>
            </div>

            <div className="shrink-0">
              <button
                onClick={onSignOut}
                aria-label="Sign out"
                className="rounded-md p-1.5"
                style={{ color: C.dim, transition: `color 170ms ${EASE}, background 170ms ${EASE}` }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FDA4AF'; e.currentTarget.style.background = 'rgba(253,164,175,0.13)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.dim; e.currentTarget.style.background = 'transparent' }}
              >
                <Icon name="signout" size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
