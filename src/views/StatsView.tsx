import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { WORD_KNOWN_STREAK } from '../../shared/constants'
import { Bilingual } from '../components/Bilingual'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { introducedWords } from '../lib/study'
import { knownWordCount, taskRates, TASK_LABELS } from '../lib/stats'
import { taskIcon } from '../lib/taskIcons'

/** Vocabulary mastered + success rate per task type. (The kanji board lives on the Kanji page.) */
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
          {rates.map((r) => {
            const icon = taskIcon(r.type)
            return (
              <li key={r.type} className="stats-row">
                <span className="stats-label">
                  {icon && <FontAwesomeIcon icon={icon} className="stats-icon" />}
                  {TASK_LABELS[r.type]}
                </span>
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
            )
          })}
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
 *
 * The card opens the full list: the number says how far along you are, the list says which words
 * got you there and which are one answer away.
 */
function KnownWordsCard() {
  const index = useContent()
  const { progress } = useProgress()
  const [listOpen, setListOpen] = useState(false)

  // Hundreds of words even part-way in — worth memoising rather than rebuilding each render.
  const words = useMemo(() => introducedWords(index, progress), [index, progress])
  const known = knownWordCount(progress, words)
  const total = words.size
  const pct = total === 0 ? 0 : Math.round((known / total) * 100)

  return (
    <>
      <button
        type="button"
        className="panel known-words"
        onClick={() => setListOpen(true)}
        disabled={total === 0}
        aria-label="Show every word and its progress"
      >
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
        {/* The chevron sits with the caption rather than beside the count: it points at the card as
            a whole, and beside the number it competed with it. */}
        <p className="known-words-note">
          <span>
            {total === 0
              ? 'Learn some kanji and the words that use them show up here.'
              : known === 0
                ? `Out of the words in the kanji you've learned. One counts once you've answered it correctly ${WORD_KNOWN_STREAK} times in a row — open to see them all.`
                : `Out of the words in the kanji you've learned. ${WORD_KNOWN_STREAK} correct in a row to count; a miss walks it back. Open to see them all.`}
          </span>
          {total > 0 && <FontAwesomeIcon icon="chevron-right" />}
        </p>
      </button>

      {listOpen && <WordListDialog onClose={() => setListOpen(false)} words={words} />}
    </>
  )
}

/** Every word in the enabled set with its progress, most-progressed first. */
function WordListDialog({ onClose, words }: { onClose: () => void; words: ReadonlySet<string> }) {
  const index = useContent()
  const { progress } = useProgress()
  const ref = useRef<HTMLDialogElement>(null)

  // `showModal` rather than the `open` attribute: only the modal form gets the focus trap, the
  // backdrop and Escape-to-close for free.
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  // Sorted by run, so what you're closest to knowing is at the top and untouched words sink.
  const rows = useMemo(() => {
    // `words` holds Progress keys, which for a form with two readings carry the reading too
    // (木|き). wordEntries is what turns one back into something displayable.
    const out = [...words].map((key) => {
      const entry = index.wordEntries.get(key)
      return {
        key,
        word: entry?.surface ?? key,
        reading: entry?.reading ?? index.wordReadings.get(key) ?? key,
        streak: progress.words?.[key] ?? 0,
      }
    })
    out.sort((a, b) => b.streak - a.streak || a.reading.localeCompare(b.reading, 'ja'))
    return out
  }, [words, index, progress])

  return (
    <dialog ref={ref} className="word-dialog" onClose={onClose}>
      <div className="word-dialog-head">
        <h2>Words you know</h2>
        <button type="button" className="word-dialog-close" onClick={() => ref.current?.close()} aria-label="Close">
          <FontAwesomeIcon icon="xmark" />
        </button>
      </div>

      <ul className="word-list">
        {rows.map((r) => (
          <li key={r.key} className="word-row">
            <span className="word-surface">{r.word}</span>
            <span className="word-reading">{r.reading}</span>
            <StreakDots streak={r.streak} />
          </li>
        ))}
      </ul>
    </dialog>
  )
}

/** WORD_KNOWN_STREAK dots; runs beyond the threshold are buffer and still show as full. */
function StreakDots({ streak }: { streak: number }) {
  const filled = Math.min(streak, WORD_KNOWN_STREAK)
  return (
    <span className="streak-dots" aria-label={`${filled} of ${WORD_KNOWN_STREAK}`}>
      {Array.from({ length: WORD_KNOWN_STREAK }, (_, i) => (
        <span key={i} className={i < filled ? 'streak-dot on' : 'streak-dot'} />
      ))}
    </span>
  )
}
