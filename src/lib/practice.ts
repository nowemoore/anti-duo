import { LEVEL_FLOOR } from '../../shared/constants'
import type { Progress } from '../../shared/types'
import type { ContentIndex } from './content'
import { introducedUnits } from './study'
import { hasAnyTask } from './tasks'

const lvlOf = (progress: Progress, idx: number): number => progress.units[idx]?.lvl ?? 0

/** Strength of the pull toward lower-level kanji (higher = more aggressive evening). */
const WEIGHT_EXPONENT = 2

interface PickOpts {
  avoidIdx?: number
}

/**
 * Pick the next target kanji from the introduced set, weighted toward the **lowest level**
 * so practice keeps every kanji at a similar level. Avoids repeating the previous target
 * when alternatives exist. Returns null if nothing is practisable.
 */
export function pickTarget(
  index: ContentIndex,
  progress: Progress,
  opts: PickOpts = {},
): number | null {
  const pool = introducedUnits(index, progress).filter((k) => hasAnyTask(index, k.idx))
  if (pool.length === 0) return null

  let candidates = pool
  if (opts.avoidIdx != null && pool.length > 1) {
    candidates = pool.filter((k) => k.idx !== opts.avoidIdx)
  }

  const maxLvl = Math.max(...candidates.map((k) => lvlOf(progress, k.idx)))
  const weights = candidates.map((k) =>
    Math.pow(maxLvl - lvlOf(progress, k.idx) + 1, WEIGHT_EXPONENT),
  )
  const total = weights.reduce((a, b) => a + b, 0)

  let r = Math.random() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r <= 0) return candidates[i].idx
  }
  return candidates[candidates.length - 1].idx
}

/**
 * Apply a score delta to the target kanji's level (fractional or negative). Levels are clamped at
 * {@link LEVEL_FLOOR}; dropping below INTRODUCED_LEVEL means the kanji is forgotten and re-taught.
 */
export function awardDelta(progress: Progress, targetIdx: number, delta: number): Progress {
  const next = Math.max(LEVEL_FLOOR, lvlOf(progress, targetIdx) + delta)
  return {
    ...progress,
    units: { ...progress.units, [targetIdx]: { lvl: next } },
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
