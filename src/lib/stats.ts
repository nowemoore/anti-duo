import { WORD_KNOWN_STREAK, WORD_STREAK_MAX } from '../../shared/constants'
import type { Progress } from '../../shared/types'
import { ALL_TASK_TYPES, TASK_SPECS, type TaskType } from './tasks'

/** Human labels per task type — derived from the task registry (single source of truth). */
export const TASK_LABELS = Object.fromEntries(TASK_SPECS.map((s) => [s.kind, s.label])) as Record<
  TaskType,
  string
>

/**
 * Points earned by one answer, in [0, 1]. Task deltas run [-1, +1] (−1 = fully wrong, +1 = fully
 * right), so this maps a wrong answer to 0 and a right one to 1 — and gives which-words its
 * per-option partial credit in between. Possible points per attempt are always 1.
 */
export function earnedPoints(delta: number): number {
  return (Math.max(-1, Math.min(1, delta)) + 1) / 2
}

/** Record one answered task: +1 attempt and its earned points against that task type's tally. */
export function recordTaskResult(progress: Progress, type: TaskType, delta: number): Progress {
  const prev = progress.stats?.[type] ?? { attempts: 0, points: 0 }
  return {
    ...progress,
    stats: {
      ...progress.stats,
      [type]: { attempts: prev.attempts + 1, points: prev.points + earnedPoints(delta) },
    },
  }
}

// ---------------------------------------------------------------------------
// Per-word "known" tracking
// ---------------------------------------------------------------------------

/**
 * Move a word's correct-run by one answer. Correct climbs toward {@link WORD_KNOWN_STREAK}, wrong
 * steps back down — a miss counts against the word rather than wiping the run entirely.
 *
 * Keyed by the written form, so a word shared by two kanji (一人 under both 一 and 人) is one entry.
 * Zeroed runs are dropped so the map doesn't accumulate an entry per word ever seen.
 */
export function recordWordResult(progress: Progress, word: string, correct: boolean): Progress {
  if (!word) return progress
  const prev = progress.words?.[word] ?? 0
  const next = correct ? Math.min(WORD_STREAK_MAX, prev + 1) : Math.max(0, prev - 1)
  return setWordStreak(progress, word, next)
}

/**
 * Re-score an answer that has already been recorded, without counting it twice. Swaps the points a
 * delta earned for the points a different one earns; the attempt itself still happened, so the
 * attempt count is untouched.
 *
 * Used when a draw verdict is overridden: the question was asked and answered once, but by the
 * learner's account it went the other way.
 */
export function amendTaskResult(
  progress: Progress,
  type: TaskType,
  oldDelta: number,
  newDelta: number,
): Progress {
  const cur = progress.stats?.[type]
  if (!cur || oldDelta === newDelta) return progress
  const points = Math.max(0, cur.points - earnedPoints(oldDelta) + earnedPoints(newDelta))
  return { ...progress, stats: { ...progress.stats, [type]: { attempts: cur.attempts, points } } }
}

/** Set a word's run outright. Zeroed runs are dropped so the map doesn't grow forever. */
export function setWordStreak(progress: Progress, word: string, streak: number): Progress {
  if (!word) return progress
  const prev = progress.words?.[word] ?? 0
  if (streak === prev) return progress
  const words = { ...progress.words }
  if (streak <= 0) delete words[word]
  else words[word] = streak
  return { ...progress, words }
}

/**
 * Undo a recorded answer by restoring the run to what it was, rather than applying the opposite
 * operation. The two differ at the boundaries: a miss recorded against a run already at 0 changes
 * nothing, so "add one back" would hand out a point the learner never earned.
 */
export function restoreWordStreak(progress: Progress, word: string, previous: number): Progress {
  return setWordStreak(progress, word, previous)
}

/** True once the learner has answered this word correctly enough times in a row. */
export function isWordKnown(progress: Progress, word: string): boolean {
  return (progress.words?.[word] ?? 0) >= WORD_KNOWN_STREAK
}

/**
 * How many distinct words have reached the known threshold. Pass `within` to count only words in a
 * given set — the Stats card scopes to the enabled learning set, so the count can't exceed its own
 * denominator when a category is switched off.
 */
export function knownWordCount(progress: Progress, within?: ReadonlySet<string>): number {
  let n = 0
  for (const [word, streak] of Object.entries(progress.words ?? {})) {
    if (streak >= WORD_KNOWN_STREAK && (!within || within.has(word))) n++
  }
  return n
}

export interface TaskRate {
  type: TaskType
  attempts: number
  /** Success rate in [0, 1] (earned points ÷ attempts), or null if never attempted. */
  rate: number | null
}

/** Success rate per task type (defaults to the built-in roster; pass a language's `tasks` to scope it). */
export function taskRates(progress: Progress, types: readonly TaskType[] = ALL_TASK_TYPES): TaskRate[] {
  return types.map((type) => {
    const s = progress.stats?.[type]
    return {
      type,
      attempts: s?.attempts ?? 0,
      rate: s && s.attempts > 0 ? s.points / s.attempts : null,
    }
  })
}
