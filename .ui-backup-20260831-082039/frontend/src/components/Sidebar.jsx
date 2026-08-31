import { useEffect, useState } from 'react'
import Icon, { Wordmark } from './Icon.jsx'

/**
 * Application sidebar — DARK BLUE premium navigation panel.
 * Collapsible, persistent via localStorage. All functionality unchanged.
 */

const SIDEBAR_BG     = '#0B1F3A'
const SIDEBAR_HOVER  = 'rgba(255,255,255,0.06)'
const SIDEBAR_ACTIVE = 'rgba(74,158,224,0.18)'
const SIDEBAR_BORDER = 'rgba(255,255,255,0.09)'

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
  { id: 'vqa',       icon: 'vqa',       label: 'VQA',       dot: '#4A9EE0' },
  { id: 'grounding', icon: 'grounding', label: 'Grounding', dot: '#4A9EE0' },
  { id: 'indices',   icon: 'indices',   label: 'Indices',   dot: '#34D399' },
  { id: 'fusion',    icon: 'fusion',    label: 'Fusion',    dot: '#F59E0B' },
  { id: 'change',    icon: 'change',    label: 'Change',    dot: '#F87171' },
]

function NavRow({ icon, label, active, open, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex w-full items-center text-left rounded-lg transition-all duration-150"
      style={{
        gap: open ? '10px' : '0',
        padding: open ? '9px 12px' : '9px 0',
        justifyContent: open ? 'flex-start' : 'center',
        background: active ? SIDEBAR_ACTIVE : hovered ? SIDEBAR_HOVER : 'transparent',
        color: active ? '#FFFFFF' : hovered ? '#D4E6F5' : '#A8C0D6',
      }}
    >
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
              style={{ background: '#4A9EE0' }} />
      )}
      <span className="shrink-0 flex items-center justify-center" style={{ width: 22, height: 22 }}>
        <Icon name={icon} size={20} />
      </span>
      {open && (
        <span className="min-w-0 flex-1 truncate text-[13.5px]"
              style={{ fontWeight: active ? 600 : 500, letterSpacing: '-0.01em' }}>
          {label}
        </span>
      )}
      {!open && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] uppercase shadow-xl group-hover:block"
              style={{ background: '#0B1F3A', color: '#E2EBF4', border: `1px solid ${SIDEBAR_BORDER}`, letterSpacing: '0.12em', fontFamily: 'monospace' }}>
          {label}
        </span>
      )}
    </button>
  )
}

function SceneRow({ icon, label, meta, active, open, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex w-full items-center text-left rounded-lg transition-all duration-150"
      style={{
        gap: open ? '10px' : '0',
        padding: open ? '7px 12px' : '7px 0',
        justifyContent: open ? 'flex-start' : 'center',
        background: active ? SIDEBAR_ACTIVE : hovered ? SIDEBAR_HOVER : 'transparent',
        color: active ? '#FFFFFF' : hovered ? '#D4E6F5' : '#A8C0D6',
      }}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
              style={{ background: '#4A9EE0' }} />
      )}
      <span className="shrink-0 flex items-center justify-center" style={{ width: 20, height: 20 }}>
        <Icon name={icon} size={17} />
      </span>
      {open && (
        <>
          <span className="min-w-0 flex-1 truncate text-[13px]"
                style={{ fontWeight: active ? 600 : 400 }}>
            {label}
          </span>
          {meta && (
            <span className="shrink-0 text-[10.5px] font-mono" style={{ color: '#6B8FAD' }}>
              {meta}
            </span>
          )}
        </>
      )}
      {!open && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] uppercase shadow-xl group-hover:block"
              style={{ background: '#0B1F3A', color: '#E2EBF4', border: `1px solid ${SIDEBAR_BORDER}`, letterSpacing: '0.12em', fontFamily: 'monospace' }}>
          {label}
        </span>
      )}
    </button>
  )
}

function Section({ title, open, children }) {
  return (
    <div style={{ padding: '14px 8px 4px' }}>
      {open ? (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase"
           style={{ color: '#3A6080', letterSpacing: '0.14em' }}>
          {title}
        </p>
      ) : (
        <div className="mx-2 mb-2" style={{ borderTop: `1px solid ${SIDEBAR_BORDER}` }} />
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

export default function Sidebar({ view, onView, activeTools = [], sceneSet, onLoadSet, session, onSignOut, onProfile }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('satquery.sidebar') !== 'closed' } catch { return true }
  })
  const [toggleHovered, setToggleHovered] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('satquery.sidebar', open ? 'open' : 'closed') } catch {}
  }, [open])

  return (
    <aside
      className="group/sidebar relative z-30 flex h-full shrink-0 flex-col
                 transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
      style={{ width: open ? '250px' : '72px', background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORDER}` }}
    >
      {/* Logo header */}
      <div
        className="flex shrink-0 items-center"
        style={{
          height: '76px',
          padding: open ? '0 14px' : '0 5px',
          justifyContent: open ? 'flex-start' : 'center',
          borderBottom: `1px solid ${SIDEBAR_BORDER}`,
        }}
      >
        <Wordmark showText={open} dark />
      </div>

      {/* Collapse/expand toggle — always visible when collapsed, hover when expanded */}
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setToggleHovered(true)}
        onMouseLeave={() => setToggleHovered(false)}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        className="absolute -right-3 z-40 grid h-6 w-6 place-items-center rounded-full
                   transition-all duration-200 group/sidebar-hover:opacity-100"
        style={{
          top: '64px',
          background: '#0B1F3A',
          border: `1px solid ${toggleHovered ? '#4A9EE0' : SIDEBAR_BORDER}`,
          color: toggleHovered ? '#4A9EE0' : '#A8C0D6',
          opacity: open ? 0 : 1,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          pointerEvents: 'auto',
        }}
      >
        <Icon name="chevron" size={12}
              className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Separate shown-on-hover toggle for expanded state */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          onMouseEnter={() => setToggleHovered(true)}
          onMouseLeave={() => setToggleHovered(false)}
          aria-label="Collapse sidebar"
          className="absolute -right-3 z-40 grid h-6 w-6 place-items-center rounded-full
                     opacity-0 group/sidebar:hover:opacity-100 transition-all duration-200"
          style={{
            top: '64px',
            background: '#0B1F3A',
            border: `1px solid ${toggleHovered ? '#4A9EE0' : SIDEBAR_BORDER}`,
            color: toggleHovered ? '#4A9EE0' : '#A8C0D6',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}
        >
          <Icon name="chevron" size={12} className="rotate-180" />
        </button>
      )}

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-2"
           style={{ scrollbarWidth: 'none' }}>
        <Section title="Navigate" open={open}>
          {NAV.map((n) => (
            <NavRow key={n.id} icon={n.icon} label={n.label}
                    open={open} active={view === n.id} onClick={() => onView(n.id)} />
          ))}
        </Section>

        <Section title="Scene library" open={open}>
          {SCENES.map((s) => (
            <SceneRow key={s.id} icon={s.icon} label={s.label} meta={open ? s.meta : null}
                      open={open} active={sceneSet === s.id} onClick={() => onLoadSet(s.id)} />
          ))}
        </Section>

        <Section title="Tool registry" open={open}>
          {TOOLS.map((t) => {
            const live = activeTools.includes(t.id)
            return (
              <div key={t.id}
                   className="flex items-center rounded-lg"
                   style={{
                     gap: open ? '10px' : '0',
                     padding: open ? '6px 12px' : '6px 0',
                     justifyContent: open ? 'flex-start' : 'center',
                     opacity: live ? 1 : 0.35,
                   }}>
                <span className="relative flex shrink-0 items-center justify-center"
                      style={{ width: 20, height: 20 }}>
                  <span className="h-2 w-2 rounded-sm"
                        style={{ background: live ? t.dot : '#3A5C7A', display: 'block' }} />
                  {live && (
                    <span className="absolute h-2 w-2 animate-pulse2 rounded-sm"
                          style={{ background: t.dot, opacity: 0.5 }} />
                  )}
                </span>
                {open && (
                  <>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]"
                          style={{ color: '#7AA5C0' }}>
                      {t.label.toLowerCase()}
                    </span>
                    <Icon name={t.icon} size={12} style={{ color: '#3A5C7A' }} />
                  </>
                )}
              </div>
            )
          })}
        </Section>
      </nav>

      {/* User footer */}
      <div
        className="flex shrink-0 items-center"
        style={{
          gap: '10px',
          padding: open ? '10px 14px' : '10px 0',
          justifyContent: open ? 'flex-start' : 'center',
          borderTop: `1px solid ${SIDEBAR_BORDER}`,
        }}
      >
        <button
          onClick={onProfile}
          aria-label="Profile"
          className="shrink-0 grid place-items-center rounded-full font-bold transition-all"
          style={{
            width: 30, height: 30,
            background: '#163461',
            color: '#FFFFFF',
            fontSize: 12,
            border: '1.5px solid rgba(74,158,224,0.3)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4A9EE0' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(74,158,224,0.3)' }}
        >
          {session.name.slice(0, 1).toUpperCase()}
        </button>
        {open && (
          <>
            <button onClick={onProfile} className="min-w-0 flex-1 text-left hover:opacity-80 transition-opacity">
              <span className="block truncate text-[12px] font-semibold leading-tight"
                    style={{ color: '#FFFFFF' }}>
                {session.name}
              </span>
              <span className="block truncate font-mono text-[10px]"
                    style={{ color: '#6B8FAD' }}>
                {session.role}
              </span>
            </button>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              className="shrink-0 rounded-md p-1.5 transition-all"
              style={{ color: '#6B8FAD' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#6B8FAD'; e.currentTarget.style.background = 'transparent' }}
            >
              <Icon name="signout" size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
