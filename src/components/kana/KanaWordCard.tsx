import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { KanaWord } from '../../../shared/types'
import { HoldToReveal } from '../HoldToReveal'
import { SpeakButton } from '../SpeakButton'

/** How many usage phrases the card has room for. The db ships one today; the list takes more. */
const MAX_EXAMPLES = 3

/**
 * One kana word, on the kanji Learn card's layout: the word large and centred, the magnifying glass
 * beside it, then the meaning, then the phrases it turns up in.
 *
 * What the glass reveals is what differs by course. A kanji opens onto its radical and components; a
 * word written phonetically has no such parts, so it opens onto where the word came from instead
 * (ビル ← ビルディング) — the only breakdown it can have.
 *
 * Nothing here is a step to complete: a kana word needs no tracing and no example vocabulary of its
 * own, because it is already the word. This is a place to meet it, not a card to finish.
 *
 * The phrases carry no English on screen — hold the eye and the meaning appears, the way every other
 * card in the app treats a translation. Reading the Japanese has to be the thing you try first.
 */
export function KanaWordCard({ word }: { word: KanaWord }) {
  const [expanded, setExpanded] = useState(false)
  const examples = word.examples.slice(0, MAX_EXAMPLES)
  const hasNote = Boolean(word.note)

  return (
    <div className="learn-card kana-word-card">
      <div className="kanji-reveal">
        <div className="kanji-box">
          {/* Not `big-kanji`: the brush face is reserved for kanji as objects of study, and kana is
              set in the same gothic it wears everywhere else in the course. */}
          <div className="big-kana">{word.word}</div>
          {hasNote && (
            <button
              type="button"
              className="reveal-btn"
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide origin' : 'Where this word comes from'}
              onClick={() => setExpanded((v) => !v)}
            >
              <FontAwesomeIcon icon="magnifying-glass" />
            </button>
          )}
        </div>
      </div>

      {/* The kanji spelling that exists but isn't normally used (有る for ある). Small and grey: a
          footnote about the word, not how you should write it. */}
      {word.rareKanji && <div className="kana-rare">{word.rareKanji}</div>}

      {hasNote && expanded && <p className="kana-note">{word.note}</p>}

      <div className="gloss kana-gloss-row">
        <span>{word.gloss.join(', ')}</span>
        <SpeakButton text={word.word} label={`Pronounce ${word.word}`} />
      </div>

      {/* The word in use. Phrases, not vocabulary: a kana word teaches no other words. */}
      <ul className="examples">
        {examples.map((ex, i) => (
          <li key={i} className="example">
            <span className="ex-word">{ex.word}</span>
            {/* The reading, not the meaning: how to say it without saying what it means. */}
            <span className="ex-reading">{ex.reading}</span>
            <span className="ex-actions">
              <SpeakButton text={ex.reading} label={`Pronounce ${ex.word}`} />
              <HoldToReveal label={`Meaning of ${ex.word}`}>{ex.meaning}</HoldToReveal>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
