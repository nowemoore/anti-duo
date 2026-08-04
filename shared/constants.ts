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

/**
 * Best-attempt accuracy (0–1) a grammar minigame must reach before its explanation unlocks.
 * Measured against the learner's *best* attempt, so retries can only help.
 */
export const GRAMMAR_PASS_ACCURACY = 0.8

/** Items presented in one grammar minigame attempt, sampled from whatever the learner has available. */
export const GRAMMAR_RUN_ITEMS = 20

/**
 * How many items a learner-derived bank must offer before its minigame unlocks. Below this there
 * isn't enough material for a meaningful run, and the pass threshold gets too coarse to mean much.
 */
export const GRAMMAR_MIN_ITEMS = 20

/**
 * How many minigame attempts to retain per topic. Progress is one JSON blob (AsyncStorage locally,
 * one Supabase row per user), so attempt history is capped to keep the payload bounded; the oldest
 * are dropped first. Ample for the error analytics the per-item results are kept for.
 */
export const GRAMMAR_ATTEMPT_HISTORY = 50

export const DEFAULT_SETTINGS: Settings = {
  name: '',
  disabledCategories: [],
  disabledUnits: [],
  taskWeights: {},
}

/** Fresh progress for a brand-new user: every unit at lvl 0. */
export function defaultProgress(): Progress {
  return {
    settings: { ...DEFAULT_SETTINGS },
    units: {},
  }
}
