import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useProgress } from '../context/ProgressContext'
import { AccountSettings } from '../components/AccountSettings'
import { CategorySettings } from '../components/CategorySettings'
import { TaskFrequencySettings } from '../components/TaskFrequencySettings'

export default function SettingsView() {
  const { progress, update, saving } = useProgress()
  const { name } = progress.settings

  // Moved off the study home, where it sat under the greeting: it's a settings action, and having
  // it one click from "start learning" was never the right neighbourhood for it.
  function resetProgress() {
    if (
      !window.confirm(
        'Reset all learning progress? Your introduced kanji and levels will be cleared (your name and dataset selection are kept).',
      )
    ) {
      return
    }
    update((p) => ({ settings: p.settings, units: {} }))
  }

  return (
    <div className="settings-page">
      <section className="panel settings">
        <h2>Profile</h2>

        <label className="field">
          <span className="field-label">Your name</span>
          <input
            type="text"
            value={name}
            placeholder="Enter your name"
            onChange={(e) =>
              update((p) => ({ ...p, settings: { ...p.settings, name: e.target.value } }))
            }
          />
        </label>

        <p className="save-state">
          {saving ? (
            <>
              <FontAwesomeIcon icon="spinner" spin /> Saving…
            </>
          ) : (
            <>
              <FontAwesomeIcon icon="check" /> Saved
            </>
          )}
        </p>
      </section>

      <section className="panel settings">
        <h2>Progress</h2>
        <p className="muted">
          Clears every kanji you&apos;ve unlocked and their levels. Your name and which kanji are
          switched on are kept. There is no undo.
        </p>
        <button type="button" className="reset-btn" onClick={resetProgress}>
          <FontAwesomeIcon icon="trash-can" />
          reset progress
        </button>
      </section>

      {/* Directly under the profile: signing in is the other half of "who is this progress for". */}
      <AccountSettings />

      <CategorySettings />

      <TaskFrequencySettings />
    </div>
  )
}
