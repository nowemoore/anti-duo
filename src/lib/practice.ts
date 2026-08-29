import { EXPLORE_RATE, LEVEL_FLOOR, WARMUP_LEVEL, WARMUP_MAX_LOSS } from '../../shared/constants'
import type { KanaWord, Progress } from '../../shared/types'
import type { ContentIndex } from './content'
import { introducedUnits } from './study'
import { TASK_TUNING, hasAnyTask, type TaskType } from './tasks'
import { isWordMet } from './kana'
import { pickKanaTarget } from './kanaTasks'

const lvlOf = (progress: Progress, idx: number): number => progress.units[idx]?.lvl ?? 0

/** Strength of the pull toward lower-level kanji (higher = more aggressive evening). */
const WEIGHT_EXPONENT = 2

interface PickOpts {
  avoidIdx?: number
  /**
   * Overrides {@link EXPLORE_RATE}. Set to 0 to make a pick fully deterministic in its weighting —
   * used by the checks, which assert the levelling behaviour and would otherwise see noise.
   */
  exploreRate?: number
}

/** A chosen target, and whether it was chosen by the weighting or by the exploration slice.
 *  Named TargetPick rather than Pick so it cannot shadow the built-in `Pick<T, K>` utility type. */
export interface TargetPick {
  idx: number
  /**
   * True when this target was drawn uniformly rather than by level weight. Recorded on the answer so
   * retention analysis can restrict itself to gaps the scheduler didn't choose. See
   * {@link EXPLORE_RATE}.
   */
  random: boolean
}

/**
 * Pick the next target kanji from the introduced set, weighted toward the **lowest level**
 * so practice keeps every kanji at a similar level. Avoids repeating the previous target
 * when alternatives exist. Returns null if nothing is practisable.
 *
 * A small {@link EXPLORE_RATE} fraction of picks ignore the weighting entirely and draw uniformly.
 * Those are flagged `random` so the answer log can tell an unbiased review gap from one the
 * scheduler manufactured.
 */
export function pickTarget(index: ContentIndex, progress: Progress, opts: PickOpts = {}): TargetPick | null {
  const pool = introducedUnits(index, progress).filter((k) => hasAnyTask(index, k.idx))
  if (pool.length === 0) return null

  let candidates = pool
  if (opts.avoidIdx != null && pool.length > 1) {
    candidates = pool.filter((k) => k.idx !== opts.avoidIdx)
  }

  const rate = opts.exploreRate ?? EXPLORE_RATE
  if (rate > 0 && Math.random() < rate) {
    return { idx: candidates[Math.floor(Math.random() * candidates.length)].idx, random: true }
  }

  const maxLvl = Math.max(...candidates.map((k) => lvlOf(progress, k.idx)))
  const weights = candidates.map((k) =>
    Math.pow(maxLvl - lvlOf(progress, k.idx) + 1, WEIGHT_EXPONENT),
  )
  const total = weights.reduce((a, b) => a + b, 0)

  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return { idx: candidates[i].idx, random: false }
  }
  return { idx: candidates[candidates.length - 1].idx, random: false }
}

/**
 * The level change one answer earns: the raw ±1-ish score scaled by the task type's weight, then
 * damped if the kanji is still warming up.
 *
 * The damping exists because a kanji is introduced at exactly INTRODUCED_LEVEL and `pickTarget`
 * weights new kanji up quadratically — so a freshly learned one is very likely to be asked first,
 * and before this a single missed cloze (-0.7) took it most of the way back to the floor. Capping
 * the loss at {@link WARMUP_MAX_LOSS} while below {@link WARMUP_LEVEL} makes that take three misses
 * of any task type instead of one. Gains are never damped.
 *
 * Shared by both clients so the two can't drift; previously this arithmetic was duplicated in each
 * PracticeSession.
 */
export function levelDeltaFor(kind: TaskType, score: number, currentLvl: number): number {
  const tuning = TASK_TUNING[kind]
  const delta = score * (score >= 0 ? tuning.pointsUp : tuning.pointsDown)
  if (delta >= 0 || currentLvl >= WARMUP_LEVEL) return delta
  return Math.max(delta, -WARMUP_MAX_LOSS)
}

/**
 * Apply a score delta to the target kanji's level (fractional or negative). Levels are clamped at
 * {@link LEVEL_FLOOR}; reaching the floor means the kanji is forgotten and re-taught.
 */
export function awardDelta(progress: Progress, targetIdx: number, delta: number): Progress {
  const next = Math.max(LEVEL_FLOOR, lvlOf(progress, targetIdx) + delta)
  // Spread the existing record: this used to write `{ lvl }` alone, which silently dropped
  // `seenBatches` on every answer — so the "new words waiting" marker reappeared after any practice.
  return {
    ...progress,
    units: { ...progress.units, [targetIdx]: { ...progress.units[targetIdx], lvl: next } },
  }
}

/**
 * Stamp when a unit was last practised. Called for **every** answered question, including the ones
 * that earn no level change, because the gap between reviews is a fact about exposure rather than
 * about scoring.
 *
 * Read before the update to fill `prev_seen_at` on the logged answer; see {@link UnitProgress}.
 */
export function markSeen(progress: Progress, targetIdx: number, at: string): Progress {
  return {
    ...progress,
    units: { ...progress.units, [targetIdx]: { ...progress.units[targetIdx], lvl: lvlOf(progress, targetIdx), lastSeenAt: at } },
  }
}

/** Min/max level across the introduced set — a measure of how even the levels are. */
export function levelSpread(
  index: ContentIndex,
  progress: Progress,
): { min: number; max: number } | null {
  const introduced = introducedUnits(index, progress)
  if (introduced.length === 0) return null
  const levels = introduced.map((k) => lvlOf(progress, k.idx))
  return { min: Math.min(...levels), max: Math.max(...levels) }
}

// ---------------------------------------------------------------------------
// Mixed targets: kanji units and kana words in one run
// ---------------------------------------------------------------------------

/**
 * What a practice run is currently asking about.
 *
 * Two kinds, because the two halves of the vocabulary are different objects: a kanji is a `Unit`
 * with a level, a kana word is a word with a streak. Everything downstream — generation, scoring,
 * what gets written to progress — branches here and nowhere else.
 */
export type MixedTarget =
  | { kind: 'unit'; idx: number; random: boolean }
  | { kind: 'kana'; word: KanaWord }

/**
 * Pick the next target from both halves of the vocabulary.
 *
 * Kana words are eligible once *met* — opened from the vocabulary list, or answered right in the
 * word drill — which is the kana equivalent of a kanji being introduced. Neither half is favoured:
 * the draw is proportional to how much of each the learner owns, so someone who has met four words
 * and eighty kanji is asked about kanji most of the time, and the balance shifts on its own as the
 * kana list fills up.
 *
 * Within the kanji half the existing level-evening weighting still applies ({@link pickTarget}).
 */
export function pickMixedTarget(
  index: ContentIndex,
  progress: Progress,
  opts: PickOpts = {},
): MixedTarget | null {
  const kana = (index.content.kanaWords ?? []).filter((w) => isWordMet(progress, w.idx))
  const units = introducedUnits(index, progress).filter((k) => hasAnyTask(index, k.idx))
  if (units.length === 0 && kana.length === 0) return null

  const kanaShare = kana.length / (kana.length + units.length)
  if (kana.length > 0 && Math.random() < kanaShare) {
    const word = pickKanaTarget(index, kana)
    if (word) return { kind: 'kana', word }
  }
  const unit = pickTarget(index, progress, opts)
  if (unit) return { kind: 'unit', idx: unit.idx, random: unit.random }
  // The kanji half had nothing askable after all — fall back rather than end the run early.
  const word = pickKanaTarget(index, kana)
  return word ? { kind: 'kana', word } : null
}
