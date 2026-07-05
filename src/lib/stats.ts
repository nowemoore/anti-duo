import type { Progress } from '../../shared/types'
import { ALL_TASK_TYPES, type TaskType } from './tasks'

/** Human labels for each task type (mirrors the Manual's task titles). */
export const TASK_LABELS: Record<TaskType, string> = {
  'type-word': 'Type the reading',
  'which-words': 'Which words are real',
  cloze: 'Fill in the kanji',
  'pick-reading': 'Pick the reading',
  'pick-meaning': 'Pick the meaning',
  'draw-kanji': 'Draw the kanji',
}

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

export interface TaskRate {
  type: TaskType
  attempts: number
  /** Success rate in [0, 1] (earned points ÷ attempts), or null if never attempted. */
  rate: number | null
}

/** Success rate per task type, in a stable order, for the Stats view. */
export function taskRates(progress: Progress): TaskRate[] {
  return ALL_TASK_TYPES.map((type) => {
    const s = progress.stats?.[type]
    return {
      type,
      attempts: s?.attempts ?? 0,
      rate: s && s.attempts > 0 ? s.points / s.attempts : null,
    }
  })
}
