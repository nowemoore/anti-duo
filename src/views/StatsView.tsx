import { useMemo } from 'react'
import { WORD_KNOWN_STREAK } from '../../shared/constants'
import { Bilingual } from '../components/Bilingual'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { enabledWords } from '../lib/study'
import { knownWordCount, taskRates, TASK_LABELS } from '../lib/stats'

/** Vocabulary mastered + success rate per task type. */
export default function StatsView() {
  const { progress } = useProgress()
  const rates = taskRates(progress)
  const totalAttempts = rates.reduce((n, r) => n + r.attempts, 0)

  return (
    <>
      <KnownWordsCard />
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
    </>
  )
}

/**
 * Vocabulary you've shown you know, as opposed to kanji you've been introduced to. A word counts
 * once you've answered it right WORD_KNOWN_STREAK times running; a miss walks it back.
 *
 * Both numbers are scoped to the enabled learning set, so switching a category off moves the total
 * as well as the count — the caption says so, since otherwise it reads as lost progress.
 */
function KnownWordsCard() {
  const index = useContent()
  const { progress } = useProgress()

  // 900+ words across every unit — worth memoising rather than rebuilding the set each render.
  const words = useMemo(() => enabledWords(index, progress), [index, progress])
  const known = knownWordCount(progress, words)
  const total = words.size
  const pct = total === 0 ? 0 : Math.round((known / total) * 100)

  return (
    <section className="panel known-words">
      <h2>
        <Bilingual ja="覚えた言葉" en="Words you know" />
      </h2>
      <p className="known-words-count">
        <strong>{known}</strong>
        <span className="known-words-of">/ {total}</span>
      </p>
      <span className="stats-bar">
        <span className="stats-bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <p className="known-words-note">
        {known === 0
          ? `A word counts here once you've answered it correctly ${WORD_KNOWN_STREAK} times in a row.`
          : `${WORD_KNOWN_STREAK} correct in a row to count; a miss walks it back. Out of the words in your enabled set.`}
      </p>
    </section>
  )
}
