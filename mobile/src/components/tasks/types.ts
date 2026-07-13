import type { FC } from 'react'
import type { Task } from '@lib/tasks'
import type { LanguagePack } from '../../lang/types'

export type QAPhase = 'first' | 'retry' | 'revealed'

/**
 * One practice question plus the user's answer state. The answer is **opaque** — its shape is owned by
 * the task's module (`TaskUI.emptyAnswer`), so the session can hold/replay it without knowing the task.
 */
export interface QA {
  task: Task
  targetIdx: number
  answer: unknown
  phase: QAPhase
  score: number // final delta once revealed
  recorded: boolean // whether it has been applied to progress
  overridden?: boolean // a wrong verdict was overridden (e.g. draw "I got it right") — penalty cancelled
}

/** Result of locking in an answer: revealed with a score, or bounced back to retry. */
export type Resolution<A = unknown> =
  | { phase: 'revealed'; score: number; answer?: A }
  | { phase: 'retry'; answer?: A }

/** Props every task View receives; it reaches reveal/pack/content itself via hooks. */
export interface TaskViewProps<T extends Task = Task, A = unknown> {
  task: T
  answer: A
  setAnswer: (a: A) => void
  phase: QAPhase
  score: number
  onLock: () => void
  onGiveUp: () => void
}

/**
 * A task's mobile half: its answer state, its view, how it grades, and its per-task UI quirks. Paired
 * with the engine-side TaskSpec (generation) by `kind` in the registry. Built-ins live in the global
 * registry; a language pack contributes its own (draw, plural…) — see registry.ts.
 */
export interface TaskUI<T extends Task = Task, A = unknown> {
  emptyAnswer: () => A
  /** Whether there's enough of an answer to lock in (enables the lock button). */
  hasAnswer: (answer: A) => boolean
  View: FC<TaskViewProps<T, A>>
  /** Grade on lock-in for the current phase: a revealed score, or a retry. */
  resolve: (task: T, answer: A, phase: QAPhase, pack: LanguagePack) => Resolution<A>
  /** Bottom reveal-strip hint per phase; omit entirely to render no strip (draw owns its own space). */
  revealHint?: (phase: QAPhase, pack: LanguagePack) => string
  /** false → the View renders its own lock / give-up (type-word). Default/true → the session pager's lock. */
  pagerLock?: boolean
  /** false → the session disables its scroll so the task owns vertical gestures (the draw canvas). */
  scrollable?: boolean
  /** If set, a revealed-wrong answer shows this override link (draw's "I got it right"); undo is generic. */
  overrideLabel?: string
}
