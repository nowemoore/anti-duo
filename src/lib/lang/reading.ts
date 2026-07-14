// Generic "pick the reading" distractor helpers, shared by the per-language engines. Pure and
// script-agnostic: they rank candidate readings by how confusable they are (shared prefix/suffix/
// length) and wrap a correct answer + distractors into a shuffled option set. Language-specific
// rules (JA okurigana) layer on top of these in each engine.
import type { Option } from '../tasks'
import { shuffle } from '../random'

/** Reading-distractor sizing (mirrors the choice-task constants in tasks.ts). */
export const CHOICE_DISTRACTORS = 3
export const MIN_CHOICE_DISTRACTORS = 2

/** Length of the longest common prefix of two strings. */
export function commonPrefixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/** Length of the longest common suffix of two strings. */
export function commonSuffixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

/**
 * How confusable a candidate reading is with the correct one: shared suffix (weighted highest — the
 * visible ending), shared prefix, and matching length. Higher = harder to tell apart.
 */
export function readingSimilarity(candidate: string, correct: string): number {
  return (
    2 * commonSuffixLen(candidate, correct) +
    commonPrefixLen(candidate, correct) +
    (candidate.length === correct.length ? 1 : 0)
  )
}

/** Wrap a correct reading + its distractors into a shuffled single-choice option set (null if too few). */
export function toOptionSet(correct: string, distractors: string[]): Option[] | null {
  if (distractors.length < MIN_CHOICE_DISTRACTORS) return null
  return shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
}

/** Pool readings (minus the answer) ranked most-confusable first. */
export function bySimilarity(correct: string, pool: string[]): string[] {
  return shuffle(pool.filter((x) => x !== correct)).sort(
    (a, b) => readingSimilarity(b, correct) - readingSimilarity(a, correct),
  )
}
