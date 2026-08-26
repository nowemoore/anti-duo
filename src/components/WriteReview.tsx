import { useCallback, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Unit } from '../../shared/types'
import { toTarget, type Target } from '../lib/drawTarget'
import { useHandwriting } from '../lib/useHandwriting'
import { useLearned } from '../lib/useLearned'
import { Bilingual } from './Bilingual'
import { DrawCanvas, type Stroke } from './DrawCanvas'

/** Per-item state, kept so you can flip back to a passed word and see your answer without redoing it. */
interface Slot {
  strokes: Stroke[]
  revealed: boolean
  correct: boolean
  attempt: number
}

/**
 * Write-it reinforcement after a Learn card: one word per just-learned unit, with the same lock-in
 * and pager as Practice. Low-stakes — nothing here touches levels or stats; the point is to have
 * written the character once while it's still fresh.
 *
 * Units the recognizer has no reference pattern for fall back to tracing over a faint guide rather
 * than being dropped from the review, since otherwise they'd get no writing practice at all.
 */
export function WriteReview({
  units,
  onDone,
  onPrev,
  lastStep,
  headerCount,
}: {
  units: Unit[]
  onDone: () => void
  /** Back off the first item leaves this view — in the learn flow, to the card that introduced it. */
  onPrev?: () => void
  /** True when finishing this review ends the session, so the forward control can say so. */
  lastStep?: boolean
  /** Where this sits in the wider learn session, for the header. */
  headerCount?: { current: number; total: number }
}) {
  const hw = useHandwriting()
  const isLearned = useLearned()
  const canDraw = useCallback(
    (w: string) => !!hw && hw.drawable(w) && [...w].every((c) => isLearned(c)),
    [hw, isLearned],
  )
  const canTrace = useCallback(
    (w: string) => !!hw && hw.traceable(w) && [...w].every((c) => isLearned(c)),
    [hw, isLearned],
  )
  const targets = useMemo(
    () => units.map((k) => toTarget(k, canDraw, canTrace)).filter((t): t is Target => t !== null),
    [units, canDraw, canTrace],
  )
  const [slots, setSlots] = useState<Record<number, Slot>>({})
  const [pos, setPos] = useState(0)

  const total = targets.length
  const cur = targets[pos]
  const slot: Slot = slots[pos] ?? { strokes: [], revealed: false, correct: false, attempt: 0 }

  if (!cur) {
    return (
      <section className="panel write-review">
        <div className="write-done">
          <Bilingual ja="よくできました" en="Nice work!" />
          <button type="button" className="grammar-btn" onClick={onDone}>
            Done
          </button>
        </div>
      </section>
    )
  }

  const patch = (upd: Partial<Slot>) => setSlots((s) => ({ ...s, [pos]: { ...slot, ...upd } }))

  const lockIn = () => {
    if (slot.revealed || slot.strokes.length === 0 || !hw) return
    // A traced word has no reference pattern to score against — reveal it without a verdict.
    patch({ revealed: true, correct: cur.traced ? false : hw.scoreWord(cur.word, slot.strokes).correct })
  }
  const giveUp = () => {
    if (!slot.revealed) patch({ revealed: true, correct: false })
  }
  const tryAgain = () => patch({ strokes: [], revealed: false, correct: false, attempt: slot.attempt + 1 })

  const prev = () => {
    if (pos > 0) setPos(pos - 1)
    else onPrev?.()
  }
  const canPrev = pos > 0 || onPrev != null
  // Finishing the last item ends the session, so the forward control says so rather than implying
  // there's another question behind it.
  const finishes = lastStep === true && pos + 1 >= total
  const next = () => {
    if (!slot.revealed) return
    if (pos + 1 >= total) onDone()
    else setPos(pos + 1)
  }

  const step = headerCount ?? { current: pos + 1, total }

  return (
    <section className="panel write-review">
      <div className="learn-head">
        <Bilingual
          className="step"
          ja={`書いてみよう ${step.current} / ${step.total}`}
          en={`Write ${step.current} / ${step.total}`}
        />
      </div>

      {/* No verdict for a traced word — there's nothing to check it against. */}
      {slot.revealed && !cur.traced && (
        <span className={`write-verdict${slot.correct ? ' ok' : ''}`}>
          <FontAwesomeIcon icon={slot.correct ? 'circle-check' : 'circle-xmark'} />
        </span>
      )}

      <div className="write-prompt">
        {/* The kana reading when there is one, the English meaning when there isn't. */}
        <p className={cur.reading ? 'draw-prompt' : 'draw-prompt en'}>{cur.reading || cur.meaning}</p>
        {cur.traced && <p className="write-trace-hint">Trace over the outline — not graded yet.</p>}
      </div>

      {/* Re-keyed per attempt so "Try again" gives a genuinely blank canvas. */}
      <DrawCanvas
        key={`${pos}-${slot.attempt}`}
        disabled={slot.revealed}
        initialStrokes={slot.strokes}
        onStrokes={(strokes) => {
          if (!slot.revealed) patch({ strokes })
        }}
        onNoClue={giveUp}
        guide={cur.traced ? cur.word : undefined}
        status={slot.revealed && !cur.traced ? (slot.correct ? 'right' : 'wrong') : undefined}
      />

      <div className="write-answer-slot">
        {slot.revealed && (
          <p className="draw-answer">
            <span className="draw-answer-word">{cur.word}</span>
            <span className="draw-answer-meaning">{cur.meaning}</span>
          </p>
        )}
      </div>

      <div className="write-pager">
        <button type="button" className="chevron back" onClick={prev} disabled={!canPrev} aria-label="Previous">
          <FontAwesomeIcon icon="chevron-left" />
        </button>

        {slot.revealed ? (
          <button type="button" className="write-lock" onClick={tryAgain}>
            <FontAwesomeIcon icon="rotate-left" />
            Try again
          </button>
        ) : (
          <button
            type="button"
            className="write-lock"
            onClick={lockIn}
            disabled={slot.strokes.length === 0 || !hw}
          >
            <FontAwesomeIcon icon="lock" />
            Lock in answer
          </button>
        )}

        <button
          type="button"
          className="chevron next"
          onClick={next}
          disabled={!slot.revealed}
          aria-label={finishes ? 'Finish' : 'Next'}
        >
          <FontAwesomeIcon icon={finishes ? 'check' : 'chevron-right'} />
        </button>
      </div>
    </section>
  )
}
