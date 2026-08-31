import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'

const TITLES = {
  dashboard: ['Dashboard',  'Session status, scene library and query history'],
  analyst:   ['Workspace',  'Map, layers, execution trace and export'],
  orb:       ['AI mode',    'Ask by voice or text in ten languages'],
  profile:   ['Profile',    'Account information and preferences'],
}

const MAX_CHIPS = 3

/** Small dropdown menu anchored to the avatar button. */
function UserMenu({ session, onProfile, onSignOut, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 animate-rise overflow-hidden
                 rounded-lg border border-rule bg-sheet shadow-lift"
      role="menu"
    >
      <div className="border-b border-rule px-4 py-3">
        <p className="text-[13px] font-semibold leading-tight text-ink">{session.name}</p>
        <p className="mt-0.5 text-[11px] text-ink3">{session.email}</p>
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-sm border border-primary/25
                         bg-primary-soft px-1.5 py-0.5 font-mono text-[9px] uppercase
                         tracking-eyebrow text-primary-deep">
          {session.role}
        </span>
      </div>

      <div className="py-1" role="none">
        <button
          onClick={() => { onProfile(); onClose() }}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-ink2
                     transition-colors hover:bg-wash hover:text-ink"
          role="menuitem"
        >
          <Icon name="user" size={15} className="shrink-0 text-ink3" />
          Profile
        </button>
        <button
          onClick={() => { onProfile(); onClose() }}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] text-ink2
                     transition-colors hover:bg-wash hover:text-ink"
          role="menuitem"
        >
          <Icon name="settings" size={15} className="shrink-0 text-ink3" />
          Preferences
        </button>
      </div>

      <div className="border-t border-rule py-1">
        <button
          onClick={() => { onSignOut(); onClose() }}
          className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px]
                     text-carmine-deep transition-colors hover:bg-carmine-soft"
          role="menuitem"
        >
          <Icon name="signout" size={15} className="shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function TopBar({ view, backend, mock, scenes, onReport, reportReady, session, onSignOut, onProfile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [title, sub] = TITLES[view] || ['', '']

  const status = {
    ready:    ['Backend ready', '#059669', 'text-moss-deep'],
    loading:  ['Model loading', '#D97706', 'text-ochre-deep'],
    checking: ['Connecting…',   '#94A3B8', 'text-ink3'],
    down:     ['Backend down',  '#E11D48', 'text-carmine-deep'],
  }[backend] ?? ['Unknown', '#94A3B8', 'text-ink3']

  /* Scene ids are unique by contract. A repeat here means the upload endpoint
     handed back the session's accumulated list rather than this load, and the
     bar should not multiply that mistake across the header. */
  const seen = new Set()
  const unique = (scenes || []).filter((s) => !seen.has(s.id) && seen.add(s.id))
  const chips = unique.slice(0, MAX_CHIPS)
  const extra = unique.length - chips.length

  return (
    <header className="relative flex h-[76px] shrink-0 items-center gap-4 border-b border-rule
                       bg-sheet/90 px-5 backdrop-blur-sm">
      {/* A hairline of brand colour along the bottom edge, so the chrome has a
          seam rather than dissolving into the page below it. */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
            style={{ background: 'linear-gradient(90deg, #2563EB 0%, rgba(37,99,235,0.18) 34%, transparent 72%)' }} />

      <div className="min-w-0">
        <h2 className="truncate font-display text-[17px] font-bold leading-tight tracking-tightest text-ink">
          {title}
        </h2>
        <p className="truncate text-[11.5px] leading-tight text-ink3">{sub}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {chips.length > 0 && (
          <span className="hidden items-center gap-1.5 md:flex">
            {chips.map((s) => (
              <span key={s.id} className={`key ${s.sensor === 'S1' ? 'key-ochre' : 'key-primary'}`}>
                {s.sensor} {s.acquired?.slice(0, 7)}
              </span>
            ))}
            {extra > 0 && <span className="key key-mute">+{extra}</span>}
          </span>
        )}

        {mock && <span className="key key-ochre hidden sm:inline-flex">mock data</span>}

        <button
          onClick={onReport}
          disabled={!reportReady}
          className="btn hidden py-1.5 sm:inline-flex"
        >
          <Icon name="report" size={14} />
          Report
        </button>

        <span className="flex items-center gap-2 rounded-md border border-rule bg-wash px-2.5 py-1.5">
          <span className="relative grid place-items-center" style={{ width: 7, height: 7 }}>
            <span className="block h-[7px] w-[7px] rounded-full" style={{ background: status[1] }} />
            {(backend === 'loading' || backend === 'checking') && (
              <span className="absolute h-[7px] w-[7px] animate-pulse2 rounded-full"
                    style={{ background: status[1], opacity: 0.55 }} />
            )}
          </span>
          <span className={`readout hidden lg:inline ${status[2]}`}>{status[0]}</span>
        </span>

        {session && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="User menu"
              aria-expanded={menuOpen}
              className={`grid h-9 w-9 place-items-center rounded-full font-display text-[12.5px]
                          font-bold text-white transition-all
                          hover:ring-2 hover:ring-accent/35 hover:ring-offset-1
                          ${menuOpen ? 'ring-2 ring-accent/35 ring-offset-1' : ''}`}
              style={{ background: 'linear-gradient(140deg, #2C5798, #1A3270)' }}
            >
              {session.name.slice(0, 1).toUpperCase()}
            </button>

            {menuOpen && (
              <UserMenu
                session={session}
                onProfile={onProfile}
                onSignOut={onSignOut}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </header>
  )
}
