// What to write, and how the attempt is recorded — shared by the two writing screens (DrawPractice,
// the browse-detail "write" page, and DrawReview, the post-Learn write review) so they can't drift.
import type { Unit } from '@shared/types'
import { saveDrawing } from '../../lib/drawings'
import type { RawStroke } from './handwriting'

export interface Target {
  /** The unit this word was chosen for — carried so a logged attempt can be attributed to it. */
  unitIdx: number
  word: string
  reading: string
  meaning: string
  /**
   * No reference pattern for these characters, so the answer can't be graded — the word is shown
   * faintly to trace over instead, and the strokes are kept to train the recognizer later.
   */
  traced: boolean
}

/**
 * Pick a word to write for the unit: an auto-gradable example if there is one, else the bare kanji,
 * else fall back to tracing.
 *
 * The fallback matters: 71 of the 251 curriculum kanji have no reference pattern, and a word needs
 * *every* character covered to be graded — so without it those units get no writing practice at all.
 */
export function toTarget(
  k: Unit,
  canDraw: (w: string) => boolean,
  canTrace?: (w: string) => boolean,
): Target | null {
  const pickFrom = (test: (w: string) => boolean, traced: boolean): Target | null => {
    const words = k.examples.filter((e) => test(e.word))
    if (words.length) {
      const ex = words[Math.floor(Math.random() * words.length)]
      return { unitIdx: k.idx, word: ex.word, reading: ex.reading, meaning: ex.meaning, traced }
    }
    if (test(k.form)) {
      return { unitIdx: k.idx, word: k.form, reading: '', meaning: k.gloss.join(', '), traced }
    }
    return null
  }
  return pickFrom(canDraw, false) ?? (canTrace ? pickFrom(canTrace, true) : null)
}

/**
 * Persist a traced attempt for later recognizer training. Fire-and-forget, and a no-op without a
 * signed-in user or Supabase — writing must never interrupt practice.
 *
 * Only traced attempts are logged from these screens: graded ones already flow through
 * PracticeSession, and duplicating them here would double-count.
 */
export function logTracedAttempt(
  userId: string | undefined,
  target: Target,
  strokes: RawStroke[],
): void {
  if (!userId || !target.traced || strokes.length === 0) return
  void saveDrawing({
    userId,
    lang: 'ja',
    unitIdx: target.unitIdx,
    word: target.word,
    strokes,
    correct: null, // nothing graded it
    mode: 'traced',
  }).catch(() => {})
}
