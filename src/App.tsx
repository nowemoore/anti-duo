import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { AuthProvider } from './context/AuthContext'
import { ContentProvider } from './context/ContentContext'
import { ProgressProvider } from './context/ProgressContext'
import { SyncProvider } from './context/SyncContext'
import { useProgress } from './context/ProgressContext'
import { useSync } from './context/SyncContext'
import SettingsView from './views/SettingsView'
import StatsView from './views/StatsView'
import StudyView from './views/StudyView'

type View = 'study' | 'stats' | 'settings'

export default function App() {
  return (
    <ContentProvider>
      <ProgressProvider>
        {/* Sync sits inside both: it reconciles the progress store against the signed-in account,
            and does nothing at all while signed out. */}
        <AuthProvider>
          <SyncProvider>
            <Shell />
          </SyncProvider>
        </AuthProvider>
      </ProgressProvider>
    </ContentProvider>
  )
}

function Shell() {
  const [view, setView] = useState<View>('study')
  const [studyKey, setStudyKey] = useState(0)

  // Brand and the Study tab return to the study home selection — remounting StudyView resets its
  // phase (so it leaves a Learn/Practice session and shows the Learn/Practice cards).
  const goHome = () => {
    setView('study')
    setStudyKey((k) => k + 1)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {/* The wordmark alone. The flag and the version chip were three marks competing for the
              same corner; the signature that says what this is lives in the footer instead. */}
          <button type="button" className="brand" onClick={goHome}>
            Anti-Duo
          </button>

          <nav className="nav">
            <NavChip ja="勉強" en="Study" on={view === 'study'} onClick={goHome} />
            <NavChip ja="統計" en="Stats" on={view === 'stats'} onClick={() => setView('stats')} />
            <NavChip
              ja="設定"
              en="Settings"
              on={view === 'settings'}
              onClick={() => setView('settings')}
            />
          </nav>

          {/* Account-side chrome: what the app is doing with your progress, then who you are. */}
          <div className="topbar-side">
            <BackupChip />
            <Avatar />
          </div>
        </div>
      </header>
      <div
        className={`scroll-area${view === 'settings' || view === 'stats' ? ' no-scrollbar' : ''}`}
      >
        {/* `wide` on Study only: it is a dashboard and wants the bar's full width, where Stats and
            Settings are read top to bottom and keep the narrower column. */}
        <main className={view === 'study' ? 'content wide' : 'content'}>
          {view === 'study' ? (
            <StudyView key={studyKey} />
          ) : view === 'stats' ? (
            <StatsView />
          ) : (
            <SettingsView />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span className="footer-credit">
          made with <span className="footer-heart" aria-label="love">♥</span> for language learners
        </span>
        {/* The signature, in the brush face and the accent — the one mark of the brand that isn't
            a control. It sits opposite the credit, over the skyline rather than under it. */}
        <span className="footer-mark" aria-hidden="true">
          明
        </span>
      </footer>
    </div>
  )
}

/**
 * One destination in the bar.
 *
 * Japanese leads in mincho and the English follows as a small caps label, side by side rather than
 * stacked: the chip is one name for one place, and stacking made every destination two lines tall
 * for no gain. The selected one is a lavender chip — where you *are* is state, the same thing the
 * progress bars report, so it takes the same colour rather than the accent.
 */
function NavChip({
  ja,
  en,
  on,
  onClick,
}: {
  ja: string
  en: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button type="button" className={on ? 'nav-chip on' : 'nav-chip'} onClick={onClick} aria-current={on ? 'page' : undefined}>
      <span className="nav-ja">{ja}</span>
      <span className="nav-en">{en}</span>
    </button>
  )
}

/** How long ago, in the roundest words that are still true. */
function agoLabel(at: number, now: number): string {
  const mins = Math.floor((now - at) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

/**
 * What the app is doing with your progress, as a chip in the bar.
 *
 * Only ever rendered when there is something to say: signed out there is no backup, and saying
 * "not backed up" to someone who never asked for an account is a warning about a choice they made.
 */
function BackupChip() {
  const { state, lastSyncedAt, error } = useSync()
  // A clock the chip owns, so "2 min ago" doesn't sit at "just now" until the next sync.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  if (state === 'idle') return null
  if (state === 'error') {
    return (
      <span className="backup-chip bad" title={error ?? undefined}>
        <FontAwesomeIcon icon="triangle-exclamation" />
        Sync error
      </span>
    )
  }
  if (state === 'syncing') {
    return (
      <span className="backup-chip">
        <FontAwesomeIcon icon="spinner" spin />
        Saving…
      </span>
    )
  }
  return (
    <span className="backup-chip">
      <span className="backup-dot" aria-hidden="true" />
      Backed up{lastSyncedAt ? ` · ${agoLabel(lastSyncedAt, now)}` : ''}
    </span>
  )
}

/**
 * Who is studying, as an initial.
 *
 * The name the learner set, falling back to the account's email — and to nothing at all when there
 * is neither, since an empty circle says less than no circle.
 */
function Avatar() {
  const { progress } = useProgress()
  const name = progress.settings.name.trim()
  const initial = name.slice(0, 1).toUpperCase()
  if (!initial) return null
  return (
    <span className="avatar" title={name}>
      {initial}
    </span>
  )
}
