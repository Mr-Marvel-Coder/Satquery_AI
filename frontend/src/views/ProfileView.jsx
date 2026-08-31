import { useState } from 'react'
import { MOCK } from '../api.js'
import Icon from '../components/Icon.jsx'

/**
 * Profile page. Displays session data returned from POST /auth/login.
 * In real mode: name/email/role/org come from the backend's user record.
 * In mock mode: uses the locally-generated session object.
 * Logout clears the token and redirects to the login page.
 */

function SectionHeader({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3 border-b border-rule pb-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon name={icon} size={17} />
      </span>
      <div>
        <h3 className="font-display text-[14px] font-semibold tracking-tightest text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-[12px] text-ink3">{description}</p>}
      </div>
    </div>
  )
}

function ReadOnlyField({ label, value, mono = false }) {
  return (
    <div>
      <span className="profile-field-label">{label}</span>
      <span className={`profile-field-value block ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</span>
    </div>
  )
}

function NotPersistedBadge() {
  return (
    <span className="key key-ochre">
      <Icon name="info" size={9} />
      Local only · not saved to backend
    </span>
  )
}

export default function ProfileView({ session, onSignOut }) {
  const [appearance, setAppearance] = useState('light')

  const initials = session.name.slice(0, 2).toUpperCase()
  const memberSince = new Date(session.started).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-6 py-8">

        {/* ── Page title ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="font-display text-[22px] font-bold tracking-tightest text-ink">Profile</h2>
          <p className="mt-1 text-[13px] text-ink2">
            Your account information, preferences, and security settings.
          </p>
        </div>

        <div className="space-y-6">

          {/* ── Profile header card ─────────────────────────────────────── */}
          <div className="profile-section">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              {/* Avatar */}
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full
                              bg-primary font-display text-[22px] font-bold text-white shadow-sheet">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[18px] font-bold tracking-tightest text-ink">
                  {session.name}
                </p>
                <p className="mt-0.5 text-[13px] text-ink2">{session.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="key key-primary">{session.role}</span>
                  <span className="key key-mute">{session.org}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Account information ─────────────────────────────────────── */}
          <div className="profile-section">
            <SectionHeader
              icon="user"
              title="Account information"
              description="Details about your account and current session."
            />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <ReadOnlyField label="Full name" value={session.name} />
              <ReadOnlyField label="Email address" value={session.email} />
              <ReadOnlyField label="Organisation" value={session.org} />
              <ReadOnlyField label="Role" value={session.role} />
              <ReadOnlyField label="Member since" value={memberSince} />
              <ReadOnlyField label="Session ID" value={session.session_id} mono />
            </div>
            <p className="mt-4 text-[11px] text-ink3 italic">
              Account details are read-only in this session. Contact your administrator to update them.
            </p>
          </div>

          {/* ── Preferences ──────────────────────────────────────────────── */}
          <div className="profile-section">
            <SectionHeader
              icon="settings"
              title="Preferences"
              description="Interface preferences stored locally in this browser."
            />
            <div className="mt-5 space-y-4">

              {/* Appearance */}
              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="profile-field-label">Appearance</span>
                    <p className="mt-0.5 text-[12px] text-ink2">Choose your preferred color theme.</p>
                  </div>
                  <NotPersistedBadge />
                </div>
                <div className="mt-3 flex gap-2">
                  {[
                    { id: 'light',  label: 'Light' },
                    { id: 'system', label: 'System' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAppearance(opt.id)}
                      className={`flex items-center gap-2 rounded-md border px-4 py-2 text-[12px]
                                  font-medium transition-all
                                  ${appearance === opt.id
                                    ? 'border-primary bg-primary-soft text-primary-deep'
                                    : 'border-rule bg-sheet text-ink2 hover:bg-wash'}`}
                    >
                      {appearance === opt.id && <Icon name="check" size={12} className="text-primary" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language note */}
              <div className="rounded-md border border-rule bg-wash px-4 py-3">
                <div className="flex items-start gap-2">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink3" />
                  <div>
                    <p className="text-[12px] font-medium text-ink2">Speech language</p>
                    <p className="mt-0.5 text-[11px] text-ink3">
                      The AI mode supports 10 Indian languages. Select your language in the AI mode
                      console when querying by voice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ──────────────────────────────────────────────────── */}
          <div className="profile-section">
            <SectionHeader
              icon="shield"
              title="Security"
              description="Session and authentication information."
            />
            <div className="mt-5 space-y-4">
              {/* Session info */}
              <div className="rounded-md border border-rule bg-wash px-4 py-3">
                <div className="flex items-start gap-2">
                  <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink3" />
                  <div>
                    <p className="text-[12px] font-medium text-ink2">
                      {MOCK ? 'Mock mode — local sessions' : 'Backend-validated authentication'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink3">
                      {MOCK
                        ? 'Sessions are stored locally in this browser. No credentials leave this machine. Mock mode active — no backend calls are made.'
                        : 'Credentials are validated by the backend API. A signed session token is stored in this browser. Signing out clears the token immediately.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Active session details */}
              <div>
                <span className="profile-field-label">Active session</span>
                <div className="mt-2 flex items-center gap-3 rounded-md border border-rule
                                bg-sheet px-4 py-3">
                  <span className="h-2 w-2 rounded-full bg-moss" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink">This browser session</p>
                    <p className="mt-0.5 font-mono text-[10px] text-ink3">
                      {session.session_id} · Started {memberSince}
                    </p>
                  </div>
                  <span className="key key-moss">Active</span>
                </div>
              </div>

              {/* Sign out */}
              <div className="border-t border-rule pt-4">
                <p className="text-[12px] text-ink2 mb-3">
                  Signing out will clear your local session data and return you to the login screen.
                  Your query history for this session will be lost.
                </p>
                <button
                  onClick={onSignOut}
                  className="btn border-carmine/30 bg-carmine-soft text-carmine-deep
                             hover:bg-carmine hover:text-white hover:border-carmine"
                >
                  <Icon name="signout" size={15} />
                  Sign out
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
