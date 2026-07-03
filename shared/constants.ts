import type { Progress, Settings } from './types'

/** Per-click Learn chunk: each Learn introduces this many new kanji (random, from enabled set). */
export const LEARN_CHUNK = 5

/**
 * When a learner taps "Not now" on a Learn card, the skipped kanji is re-queued this many slots
 * back in the reserve — far enough that it doesn't reappear immediately, but not dumped at the end.
 */
export const SKIP_REQUEUE_GAP = 3

/** Level at/above which a kanji counts as introduced/learned; below it the kanji is re-taught. */
export const INTRODUCED_LEVEL = 1

/** Levels never drop below this. A kanji at the floor (and below INTRODUCED_LEVEL) is re-taught. */
export const LEVEL_FLOOR = 0

/** Practice iterations per Practice session. */
export const PRACTICE_ITERATIONS = 10

/** Total kanji in the curriculum (informational; actual counts derive from the loaded content). */
export const TOTAL_KANJI = 121

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  disabledCategories: [],
  disabledKanji: [],
}

/** Fresh progress for a brand-new user: every kanji at lvl 0. */
export function defaultProgress(): Progress {
  return {
    settings: { ...DEFAULT_SETTINGS },
    kanji: {},
  }
}
