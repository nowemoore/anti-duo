import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Kanji } from '../../shared/types'
import { SKIP_REQUEUE_GAP } from '../../shared/constants'
import { skipCard } from '../lib/study'
import { useContent } from '../context/ContentContext'
import { Bilingual } from './Bilingual'
import { HoldToReveal } from './HoldToReveal'
import { HoverGloss } from './HoverGloss'
import { SpeakButton } from './SpeakButton'

interface Props {
  chunk: Kanji[]
  /** Extra queued kanji used to replace a card the learner taps "Not now" on. */
  reserve: Kanji[]
  /** Called with the final set of cards the learner kept (skipped cards excluded). */
  onComplete: (learned: Kanji[]) => void
}

/** Introduces new kanji one card at a time: char, glosses, and up to 5 example words. */
export function LearnPhase({ chunk, reserve, onComplete }: Props) {
  const [cards, setCards] = useState<Kanji[]>(chunk)
  const [pool, setPool] = useState<Kanji[]>(reserve)
  const [i, setI] = useState(0)

  const kanji = cards[i]
  const isFirst = i === 0
  const isLast = i === cards.length - 1
  // "Not now" swaps in a queued kanji when one is available; otherwise it drops the card. So it's
  // only blocked when dropping would empty the session (the sole remaining card, nothing to swap).
  const canSkip = pool.length > 0 || cards.length > 1

  const back = () => setI((n) => Math.max(0, n - 1))
  const next = () => (isLast ? onComplete(cards) : setI((n) => n + 1))

  // "Not now": swap in the next queued kanji and re-queue this one a few slots back (or drop it if
  // nothing's queued). Its progress is untouched, so a skipped forgotten kanji stays prioritized.
  const skip = () => {
    if (!canSkip) return
    const res = skipCard(cards, pool, i, SKIP_REQUEUE_GAP)
    setCards(res.cards)
    setPool(res.reserve)
    setI(res.index)
  }

  // Arrow keys mirror the chevron buttons.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && !isFirst) back()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  return (
    <section className="panel learn">
      <div className="learn-head">
        <Bilingual
          className="step"
          ja={`新しい漢字 ${i + 1} / ${cards.length}`}
          en={`New kanji ${i + 1} / ${cards.length}`}
        />
        <button
          type="button"
          className="skip-btn"
          onClick={skip}
          disabled={!canSkip}
          aria-label="Skip this kanji for now"
        >
          <FontAwesomeIcon icon="forward" />
          <Bilingual ja="あとで" en="Not now" />
        </button>
      </div>

      <LearnCard key={kanji.idx} kanji={kanji} />

      <div className="pager">
        <button
          type="button"
          className="chevron back"
          aria-label="Previous"
          disabled={isFirst}
          onClick={back}
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <button
          type="button"
          className="chevron next"
          aria-label={isLast ? 'Finish learning' : 'Next'}
          onClick={next}
        >
          <FontAwesomeIcon icon="chevron-right" />
        </button>
      </div>
    </section>
  )
}

function LearnCard({ kanji }: { kanji: Kanji }) {
  const { content } = useContent()
  const meanings = content.kanjiMeanings
  const radical = content.kanjiRadicals[kanji.char]
  const components = content.kanjiComponents[kanji.char] ?? []
  const hasReveal = Boolean(radical) || components.length > 0
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="learn-card">
      <div className={`kanji-reveal${expanded ? ' expanded' : ''}`}>
        <div className="kanji-box">
          <div className="big-kanji">{kanji.char}</div>
          {hasReveal && (
            <button
              type="button"
              className="reveal-btn"
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide breakdown' : 'Show breakdown'}
              onClick={() => setExpanded((v) => !v)}
            >
              <FontAwesomeIcon icon="magnifying-glass" />
            </button>
          )}
          {/* Lives inside kanji-box (position:relative) so its absolute position anchors to the kanji. */}
          {hasReveal && (
            <div className="reveal-panel" aria-hidden={!expanded}>
              {radical && (
                <div className="radical-row">
                  <div className="radical-frame">
                    <CompRow char={radical} meaning={meanings[radical]} />
                  </div>
                  <span className="radical-tag">radical</span>
                </div>
              )}
              {components.length > 0 && (
                <div className="component-list">
                  {components.map((c) => (
                    <CompRow key={c} char={c} meaning={meanings[c]} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="gloss">{kanji.gloss.join(', ')}</div>
      <ul className="examples">
        {kanji.examples.slice(0, 5).map((ex, idx) => (
          <li key={idx} className="example">
            <ExampleWord word={ex.word} meanings={meanings} />
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

/** A radical/component row: the character and its primary meaning (— if none in the dictionary). */
function CompRow({ char, meaning }: { char: string; meaning?: string }) {
  return (
    <div className="component">
      <span className="comp-char">{char}</span>
      <span className="comp-meaning">{compMeaning(meaning)}</span>
    </div>
  )
}

/** A component's primary (first) meaning, or a dash when it has none in the dictionary. */
function compMeaning(meaning: string | undefined): string {
  return meaning ? meaning.split(';')[0].trim() : '—'
}

/** Renders a word with each kanji character individually hoverable for its meaning. */
function ExampleWord({ word, meanings }: { word: string; meanings: Record<string, string> }) {
  return (
    <span className="ex-word">
      {[...word].map((ch, i) => {
        const gloss = meanings[ch]
        return gloss ? (
          <HoverGloss key={i} gloss={gloss} className="ex-char">
            {ch}
          </HoverGloss>
        ) : (
          <span key={i}>{ch}</span>
        )
      })}
    </span>
  )
}
