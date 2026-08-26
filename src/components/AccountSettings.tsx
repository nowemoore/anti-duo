import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../context/AuthContext'
import { useSync } from '../context/SyncContext'

/** Settings card: optional cloud login (emailed code) that backs up and syncs progress. */
export function AccountSettings() {
  const { configured, loading, session, email, sendCode, verifyCode, signOut } = useAuth()

  if (!configured) {
    return (
      <section className="panel settings account">
        <h2>Cloud backup</h2>
        <p className="muted">
          Not set up yet. Put your Supabase project URL and anon key in <code>.env.local</code> (see{' '}
          <code>.env.example</code>) to back up your progress and sync it with the phone app. Until
          then, everything is saved in this browser.
        </p>
      </section>
    )
  }

  return (
    <section className="panel settings account">
      <h2>Cloud backup</h2>
      {loading ? (
        <p className="account-status">
          <FontAwesomeIcon icon="spinner" spin /> Checking sign-in…
        </p>
      ) : session ? (
        <SignedIn email={email} onSignOut={signOut} />
      ) : (
        <SignedOut sendCode={sendCode} verifyCode={verifyCode} />
      )}
    </section>
  )
}

function SignedIn({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  const { state, error } = useSync()
  const status = {
    syncing: { icon: 'spinner', text: 'Syncing…', spin: true },
    synced: { icon: 'cloud', text: 'Backed up', spin: false },
    error: { icon: 'triangle-exclamation', text: error ?? 'Sync error', spin: false },
    idle: { icon: 'cloud', text: '', spin: false },
  }[state]

  return (
    <div className="account-body">
      <p className="muted">
        Signed in as <strong className="account-email">{email}</strong>. Your progress backs up
        automatically.
      </p>
      {status.text ? (
        <p className={state === 'error' ? 'account-status bad' : 'account-status'}>
          <FontAwesomeIcon icon={status.icon as 'cloud'} spin={status.spin} /> {status.text}
        </p>
      ) : null}
      <button type="button" className="account-btn secondary" onClick={onSignOut}>
        <FontAwesomeIcon icon="arrow-right-from-bracket" />
        Sign out
      </button>
    </div>
  )
}

function SignedOut({
  sendCode,
  verifyCode,
}: {
  sendCode: (email: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
}) {
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      after?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'email') {
    return (
      <form
        className="account-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (!busy && email.trim()) run(() => sendCode(email), () => setStage('code'))
        }}
      >
        <p className="muted">Sign in with your email — we&apos;ll send a one-time code, no password.</p>
        <input
          type="email"
          className="account-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Email address"
        />
        {error && <p className="account-error">{error}</p>}
        <button type="submit" className="account-btn" disabled={busy || !email.trim()}>
          <FontAwesomeIcon icon={busy ? 'spinner' : 'paper-plane'} spin={busy} />
          {busy ? 'Sending…' : 'Email me a code'}
        </button>
      </form>
    )
  }

  return (
    <form
      className="account-body"
      onSubmit={(e) => {
        e.preventDefault()
        if (!busy && code.length >= 6) run(() => verifyCode(email, code))
      }}
    >
      <p className="muted">
        Enter the code sent to <strong className="account-email">{email}</strong>.
      </p>
      <input
        // Digits only, and typed as one-time-code so a browser or phone can autofill it.
        className="account-input code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder="––––––"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={10}
        aria-label="Login code"
        autoFocus
      />
      {error && <p className="account-error">{error}</p>}
      <button type="submit" className="account-btn" disabled={busy || code.length < 6}>
        <FontAwesomeIcon icon={busy ? 'spinner' : 'right-to-bracket'} spin={busy} />
        {busy ? 'Verifying…' : 'Verify & sign in'}
      </button>
      <button
        type="button"
        className="account-link"
        onClick={() => {
          setStage('email')
          setCode('')
          setError(null)
        }}
      >
        Use a different email
      </button>
    </form>
  )
}
