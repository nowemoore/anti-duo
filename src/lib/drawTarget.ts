// What to write: shared by every writing surface (the post-Learn write review on web, and mobile's
// DrawPractice / DrawReview) so they can't drift on which word a unit gets.
//
// Pure TS (no React, no react-native) — vendored into the mobile app by mobile/scripts/sync-shared.js.
import type { Unit } from '../../shared/types'

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
