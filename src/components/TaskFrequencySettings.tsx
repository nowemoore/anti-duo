import { useProgress } from '../context/ProgressContext'
import { ALL_TASK_TYPES, TASK_TUNING, type TaskType } from '../lib/tasks'
import { TASK_LABELS } from '../lib/stats'

/** Slider range for the per-task appearance weight (0 = off). */
const MAX_WEIGHT = 3
const STEP = 0.1

/** Settings section: adjust how often each practice task type appears (its selection weight). */
export function TaskFrequencySettings() {
  const { progress, update } = useProgress()
  const weights = progress.settings.taskWeights ?? {}

  // The slider shows the effective weight: the user's override, or the built-in default.
  const weightOf = (t: TaskType): number => weights[t] ?? TASK_TUNING[t].weight

  const setWeight = (t: TaskType, value: number) =>
    update((p) => ({
      ...p,
      settings: { ...p.settings, taskWeights: { ...(p.settings.taskWeights ?? {}), [t]: value } },
    }))

  return (
    <section className="panel settings">
      <h2>Practice mix</h2>
      <p className="muted">
        How often each question type shows up in practice. Slide one to 0 to turn it off.
      </p>

      <ul className="mix-list">
        {ALL_TASK_TYPES.map((t) => {
          const w = weightOf(t)
          return (
            <li key={t} className="mix-row">
              <span className="mix-label">{TASK_LABELS[t]}</span>
              <input
                type="range"
                className="mix-slider"
                min={0}
                max={MAX_WEIGHT}
                step={STEP}
                value={w}
                onChange={(e) => setWeight(t, Number(e.target.value))}
                aria-label={`${TASK_LABELS[t]} frequency`}
              />
              <span className="mix-value">{w === 0 ? 'off' : `${w.toFixed(1)}×`}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
