import { Bilingual } from '../components/Bilingual'
import { useProgress } from '../context/ProgressContext'
import { taskRates, TASK_LABELS } from '../lib/stats'

/** Success rate per task type — earned points ÷ attempts, cumulative across all practice. */
export default function StatsView() {
  const { progress } = useProgress()
  const rates = taskRates(progress)
  const totalAttempts = rates.reduce((n, r) => n + r.attempts, 0)

  return (
    <section className="panel stats-view">
      <h2>
        <Bilingual ja="統計" en="Stats" />
      </h2>

      {totalAttempts === 0 ? (
        <p className="stats-empty">Practice some tasks and your success rate per type shows up here.</p>
      ) : (
        <ul className="stats-list">
          {rates.map((r) => (
            <li key={r.type} className="stats-row">
              <span className="stats-label">{TASK_LABELS[r.type]}</span>
              <span className="stats-bar">
                <span
                  className="stats-bar-fill"
                  style={{ width: `${Math.round((r.rate ?? 0) * 100)}%` }}
                />
              </span>
              <span className="stats-value">
                <span className="stats-pct">{r.rate === null ? '—' : `${Math.round(r.rate * 100)}%`}</span>
                <span className="stats-count">{r.attempts === 1 ? '1 try' : `${r.attempts} tries`}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
