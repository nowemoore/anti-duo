import type { Progress, Settings } from './types'

/** Per-click Learn chunk: each Learn introduces this many new kanji (random, from enabled set). */
export const LEARN_CHUNK = 5

/**
 * When a learner taps "Not now" on a Learn card, the skipped kanji is re-queued this many slots
 * back in the reserve — far enough that it doesn't reappear immediately, but not dumped at the end.
 */
export const SKIP_REQUEUE_GAP = 3

/** The level a kanji is introduced at. Not a classification boundary — see LEVEL_FLOOR. */
export const INTRODUCED_LEVEL = 1

/**
 * Levels never drop below this, and reaching it is what sends a kanji back to be re-taught.
 *
 * Deliberately the floor rather than {@link INTRODUCED_LEVEL}: a freshly introduced kanji sits at
 * exactly INTRODUCED_LEVEL, so classifying there left zero margin and any single wrong answer
 * un-learned it. Anchoring to the floor also means there is no limbo band — a taught kanji is either
 * practisable or being re-taught, never neither.
 */
export const LEVEL_FLOOR = 0

/**
 * Below this level a kanji is still bedding in, and one wrong answer can cost at most
 * {@link WARMUP_MAX_LOSS} regardless of how heavily the task type is normally weighted.
 */
export const WARMUP_LEVEL = 2

/**
 * The most a single miss can cost a kanji that is still warming up: a freshly introduced kanji
 * survives two misses of any task type and is re-taught on the third, where previously a single
 * missed cloze (-0.7) was enough.
 *
 * Slightly more than INTRODUCED_LEVEL / 3 on purpose — at exactly a third, three misses land on
 * 1e-16 rather than 0 and the kanji clings on for a fourth.
 */
export const WARMUP_MAX_LOSS = 0.34

/** Practice iterations per Practice session. */
export const PRACTICE_ITERATIONS = 10

/**
 * Correct answers in a row before a word counts as "known" in Stats. A wrong answer decrements the
 * run rather than resetting it, and the run is capped here — so a known word lapses on a single miss
 * rather than needing several, and can be won back with one.
 */
export const WORD_KNOWN_STREAK = 5

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
