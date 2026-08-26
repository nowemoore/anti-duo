import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { GrammarVocab } from '../../lib/grammar'
import { SpeakButton } from '../SpeakButton'

/**
 * Part 1 — the exercise vocabulary, as a plain list you can scan and refer back to.
 *
 * Japanese by default: each row shows the written form and its reading, and nothing more. The
 * English is behind the reveal button — hold it and the reading swaps out for the gloss, the same
 * hold-to-reveal gesture the kanji Learn card uses, so the translation is always something you ask
 * for rather than something you read past.
 */
export function VocabIntro({
  words,
  note,
  onDone,
  doneLabel,
}: {
  words: GrammarVocab[]
  /** Line above the list explaining what the words are for. */
  note?: string
  onDone: () => void
  doneLabel: string
}) {
  // The word whose gloss is currently held, if any. Only ever one at a time.
  const [held, setHeld] = useState<string | null>(null)

  return (
    <div>
      {note ? <p className="vocab-note">{note}</p> : null}

      <div className="vocab-list">
        {words.map((w) => {
          const on = held === w.word
          return (
            <div key={w.word} className="vocab-row">
              <span className="vocab-form">{w.word}</span>
              <span className={on ? 'vocab-reading revealed' : 'vocab-reading'}>
                {on ? w.meaning : w.reading}
              </span>
              <span className="vocab-actions">
                <SpeakButton text={w.reading} label={`Pronounce ${w.word}`} />
                <button
                  type="button"
                  className={on ? 'vocab-eye on' : 'vocab-eye'}
                  aria-label={`Meaning of ${w.word}`}
                  aria-pressed={on}
                  onMouseDown={() => setHeld(w.word)}
                  onMouseUp={() => setHeld(null)}
                  onMouseLeave={() => setHeld(null)}
                  onTouchStart={(e) => {
                    e.preventDefault()
                    setHeld(w.word)
                  }}
                  onTouchEnd={(e) => {
                    e.currentTarget.blur()
                    setHeld(null)
                  }}
                  onTouchCancel={(e) => {
                    e.currentTarget.blur()
                    setHeld(null)
                  }}
                >
                  <FontAwesomeIcon icon="eye" />
                </button>
              </span>
            </div>
          )
        })}
      </div>

      {/* Reassurance before the one button that advances the section — the list stays reachable, so
          moving on isn't a commitment to having memorised anything. */}
      <p className="vocab-comeback">You can come back to this list at any time.</p>

      <div className="grammar-actions">
        <button type="button" className="grammar-btn" onClick={onDone}>
          <FontAwesomeIcon icon="check" />
          {doneLabel}
        </button>
      </div>
    </div>
  )
}
