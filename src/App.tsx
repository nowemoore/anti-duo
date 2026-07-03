import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ContentProvider } from './context/ContentContext'
import { ProgressProvider } from './context/ProgressContext'
import { HelpButton } from './components/HelpButton'
import ManualView from './views/ManualView'
import SettingsView from './views/SettingsView'
import StatsView from './views/StatsView'
import StudyView from './views/StudyView'

type View = 'study' | 'stats' | 'settings' | 'manual'

export default function App() {
  return (
    <ContentProvider>
      <ProgressProvider>
        <Shell />
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
        <HelpButton />
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={goHome}>
            anti-duo
            <svg className="brand-flag" viewBox="0 0 30 20" aria-hidden="true">
              <rect width="30" height="20" fill="#fff" />
              <circle cx="15" cy="10" r="6" fill="#bc002d" />
            </svg>
            <span className="brand-ver">v1</span>
          </button>
          <nav className="nav">
            <button className={view === 'study' ? 'active' : ''} onClick={goHome} type="button">
              <FontAwesomeIcon icon="graduation-cap" />
              <span className="nav-labels">
                <span className="ja">勉強</span>
                <span className="en">Study</span>
              </span>
            </button>
            <button
              className={view === 'stats' ? 'active' : ''}
              onClick={() => setView('stats')}
              type="button"
            >
              <FontAwesomeIcon icon="chart-column" />
              <span className="nav-labels">
                <span className="ja">統計</span>
                <span className="en">Stats</span>
              </span>
            </button>
            <button
              className={view === 'settings' ? 'active' : ''}
              onClick={() => setView('settings')}
              type="button"
            >
              <FontAwesomeIcon icon="gear" />
              <span className="nav-labels">
                <span className="ja">設定</span>
                <span className="en">Settings</span>
              </span>
            </button>
            <button
              className={view === 'manual' ? 'active' : ''}
              onClick={() => setView('manual')}
              type="button"
            >
              <FontAwesomeIcon icon="book" />
              <span className="nav-labels">
                <span className="ja">使い方</span>
                <span className="en">Manual</span>
              </span>
            </button>
          </nav>
        </div>
      </header>
      <div
        className={`scroll-area${
          view === 'settings' || view === 'manual' || view === 'stats' ? ' no-scrollbar' : ''
        }`}
      >
        <main className="content">
          {view === 'study' ? (
            <StudyView key={studyKey} />
          ) : view === 'stats' ? (
            <StatsView />
          ) : view === 'settings' ? (
            <SettingsView />
          ) : (
            <ManualView />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span className="footer-credit">
          made with <span className="footer-heart" aria-label="love">♥</span> for language learners
        </span>
        明
      </footer>
    </div>
  )
}
