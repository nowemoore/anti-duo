import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useProgress } from '../context/ProgressContext'
import { CategorySettings } from '../components/CategorySettings'
import { TaskFrequencySettings } from '../components/TaskFrequencySettings'

export default function SettingsView() {
  const { progress, update, saving } = useProgress()
  const { name } = progress.settings

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

      <CategorySettings />

      <TaskFrequencySettings />
    </div>
  )
}
