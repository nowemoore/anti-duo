import type { Task } from '@lib/tasks'
import type { RawStroke } from '../../lib/handwriting'

export type QAPhase = 'first' | 'retry' | 'revealed'

/** One practice question plus the user's (lifted) answer state, so it can be replayed on back-nav. */
export interface QA {
  task: Task
  targetIdx: number
  chosen: number | null // choice tasks
  selected: number[] // which-words (Set serialized as array)
  typed: string // type-word
  strokes: RawStroke[] // draw-kanji
  phase: QAPhase
  score: number // final delta once revealed
  recorded: boolean // whether it has been applied to progress
  overridden?: boolean // draw-kanji: user overrode an "incorrect" verdict (penalty cancelled)
}
