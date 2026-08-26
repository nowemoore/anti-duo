import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useHandwriting } from '../../lib/useHandwriting'
import { DrawCanvas, type Stroke } from '../DrawCanvas'

/** The two halves of meeting a character by hand: copy it, then produce it unaided. */
type Half = 'trace' | 'write'

/**
 * Write the character: trace it over a guide, then write it from memory.
 *
 * This is the phone's way of meeting a character, and completing both halves is what marks it
 * studied. It sits alongside the plain "I've learned this" button rather than replacing it — a mouse
 * is a poor stylus, and on a desktop without a touchscreen the button is still the sane path.
 *
 * The written half is graded by the recognizer when it can be (every kana has a reference pattern),
 * but a wrong verdict is never a dead end: the learner can try again, or accept it and move on. The
 * point is to have formed the shape, not to pass a test.
 */
export function KanaTrace({ char, onMet }: { char: string; onMet: () => void }) {
  const hw = useHandwriting()
  const [half, setHalf] = useState<Half>('trace')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [attempt, setAttempt] = useState(0)
  const [verdict, setVerdict] = useState<boolean | null>(null)

  const hasInk = strokes.length > 0

  const restart = (next: Half) => {
    setHalf(next)
    setStrokes([])
    setVerdict(null)
    setAttempt((n) => n + 1)
  }

  /** Tracing isn't graded — there's a guide underneath, so the ink itself is the whole of it. */
  const doneTracing = () => {
    if (!hasInk) return
    restart('write')
  }

  const check = () => {
    if (!hasInk || verdict != null) return
    // No recognizer (still loading, or it failed to load) → the attempt stands on its own.
    setVerdict(hw ? hw.gradeKana(char, strokes) : true)
  }

  return (
    <div className="kana-trace">
      <div className="kana-trace-steps">
        <span className={half === 'trace' ? 'kana-trace-step on' : 'kana-trace-step done'}>
          1. Trace it
        </span>
        <span className={half === 'write' ? 'kana-trace-step on' : 'kana-trace-step'}>
          2. Write it from memory
        </span>
      </div>

      <DrawCanvas
        // Re-keyed per half and per retry, so each one starts on a genuinely blank canvas.
        key={`${char}-${half}-${attempt}`}
        disabled={verdict != null}
        onStrokes={setStrokes}
        guide={half === 'trace' ? char : undefined}
        status={verdict == null ? undefined : verdict ? 'right' : 'wrong'}
      />

      <div className="kana-trace-foot">
        {half === 'trace' ? (
          <button type="button" className="write-lock" onClick={doneTracing} disabled={!hasInk}>
            <FontAwesomeIcon icon="chevron-right" />
            Now write it from memory
          </button>
        ) : verdict == null ? (
          <button type="button" className="write-lock" onClick={check} disabled={!hasInk}>
            <FontAwesomeIcon icon="lock" />
            Lock in answer
          </button>
        ) : (
          <>
            <button type="button" className="draw-tool" onClick={() => restart('write')}>
              <FontAwesomeIcon icon="rotate-left" />
              Try again
            </button>
            {/* Either verdict lets you finish: getting it wrong means another look, not a lockout. */}
            <button type="button" className="write-lock" onClick={onMet}>
              <FontAwesomeIcon icon="check" />
              {verdict ? "That's it — mark it studied" : 'Mark it studied anyway'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
