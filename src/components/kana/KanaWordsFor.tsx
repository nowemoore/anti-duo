import { KANA_WORD_DOTS } from '../../../shared/constants'
import type { KanaWord } from '../../../shared/types'
import { charsOf, isReadable, isTraced, streakOf } from '../../lib/kana'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

/**
 * The words this character appears in — the point of learning it, listed on its own page.
 *
 * Vocabulary arrives as a consequence of character progress rather than as a separate errand: study
 * き and the words it unlocks are right there. A word whose other characters are still unmet is kept
 * in the list rather than hidden, greyed, and told what it is waiting for — the missing characters
 * are the reason it's locked, so naming them turns the lock into a next step.
 *
 * The dots are the word's *readability*, taken from its weakest character's practice run (see
 * `streakOf`), because that is the only per-word signal the progress model actually holds — nothing
 * tracks a kana word individually yet. Three dots, so they read at a glance.
 */
export function KanaWordsFor({ char }: { char: string }) {
  const { progress } = useProgress()
  const words: KanaWord[] = useContent().content.kanaWords ?? []
  const mine = words.filter((w) => w.word.includes(char))
  if (mine.length === 0) return null

  const readable = mine.filter((w) => isReadable(progress, w))
  // Readable first, then the locked ones — the list should open on what you can actually use.
  const ordered = [...readable, ...mine.filter((w) => !isReadable(progress, w))]

  return (
    <div className="kana-words">
      <div className="kana-words-head">
        <div className="kana-words-title">
          <span className="kana-words-native">{char}の言葉</span>
          <span className="kana-words-sub">Words with {char} you can read</span>
        </div>
        <span className="kana-words-count">
          {readable.length} of {mine.length}
        </span>
      </div>

      <ul className="kana-words-list">
        {ordered.map((w) => {
          const missing = charsOf(w.word).filter((c) => !isTraced(progress, c))
          const strength = Math.min(...charsOf(w.word).map((c) => streakOf(progress, c)))
          return (
            <li key={w.idx} className={missing.length ? 'kana-word locked' : 'kana-word'}>
              <span className="kana-word-form">{w.word}</span>
              {missing.length > 0 ? (
                <span className="kana-word-gloss">locked — needs {missing.join(', ')}</span>
              ) : (
                <span className="kana-word-gloss">{w.gloss.join(' / ')}</span>
              )}
              {missing.length > 0 ? (
                <FontAwesomeIcon icon="lock" className="kana-word-lock" />
              ) : (
                <span className="kana-word-dots" aria-label={`${strength} of ${KANA_WORD_DOTS}`}>
                  {Array.from({ length: KANA_WORD_DOTS }, (_, i) => (
                    <span
                      key={i}
                      className={i < Math.min(strength, KANA_WORD_DOTS) ? 'kana-word-dot on' : 'kana-word-dot'}
                    />
                  ))}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
