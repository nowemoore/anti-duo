import type { Option } from '../tasks'
import type { LangEngine } from './types'
import { shuffle } from '../random'

// Reading-distractor sizing (mirrors the choice-task constants in tasks.ts).
const CHOICE_DISTRACTORS = 3
const MIN_CHOICE_DISTRACTORS = 2

/** Length of the longest common prefix of two strings. */
function commonPrefixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

/** Length of the longest common suffix of two strings. */
function commonSuffixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

/**
 * How confusable a candidate reading is with the correct one: shared suffix (the visible okurigana,
 * weighted highest), shared prefix, and matching length. Higher = harder to tell apart.
 */
function readingSimilarity(candidate: string, correct: string): number {
  return (
    2 * commonSuffixLen(candidate, correct) +
    commonPrefixLen(candidate, correct) +
    (candidate.length === correct.length ? 1 : 0)
  )
}

/** The visible okurigana: the trailing run of kana in a surface form (上手に → に, 食べる → べる, 一 → ''). */
function okuriganaOf(surface: string): string {
  // U+3040–U+30FF spans the hiragana and katakana blocks (okurigana is kana).
  return surface.match(/[぀-ヿ]+$/)?.[0] ?? ''
}

/** Wrap a correct reading + its distractors into a shuffled single-choice option set (null if too few). */
function toOptionSet(correct: string, distractors: string[]): Option[] | null {
  if (distractors.length < MIN_CHOICE_DISTRACTORS) return null
  return shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
}

/** Pool readings (minus the answer) ranked most-confusable first — used when there's no okurigana to protect. */
function bySimilarity(correct: string, pool: string[]): string[] {
  return shuffle(pool.filter((x) => x !== correct)).sort(
    (a, b) => readingSimilarity(b, correct) - readingSimilarity(a, correct),
  )
}

/**
 * Distractors for a "pick the reading" task, honouring (in priority order):
 *  1. okurigana is never a leak — every distractor ends in the full visible okurigana;
 *  2. length is ideally not a leak — ≥2 distractors sit within a mora of the answer's length;
 *  3. similar pronunciation is preferred (ranks candidates) but not required;
 *  4. ≥2 options are real words (the answer + ≥1 real distractor), ideally more.
 * Length gaps are filled with fabricated readings (a real stem swapped in, okurigana kept). Returns
 * null when no real word shares the okurigana — the word is then skipped for this task type.
 */
function makeReadingOptions(correct: string, pool: string[], oku: string): Option[] | null {
  // No trailing okurigana to protect (e.g. a single-kanji word): fall back to plain similarity.
  if (oku === '' || !correct.endsWith(oku)) {
    return toOptionSet(correct, bySimilarity(correct, pool).slice(0, CHOICE_DISTRACTORS))
  }

  const others = pool.filter((x) => x !== correct)
  // Rule 1: distractors must reproduce the full okurigana. Rule 4 floor: need a real one to seed with.
  const realMatches = others.filter((x) => x.endsWith(oku))
  if (realMatches.length === 0) return null

  const near = (s: string): boolean => Math.abs(s.length - correct.length) <= 1
  const bySim = (a: string, b: string): number =>
    readingSimilarity(b, correct) - readingSimilarity(a, correct)

  // Real okurigana-matchers, best first: length-matched (rule 2), then confusable (rule 3).
  const reals = shuffle(realMatches).sort((a, b) => Number(near(b)) - Number(near(a)) || bySim(a, b))
  // Fabricated okurigana-matchers: swap the stem, keep the okurigana, length-matched by construction.
  const synths = shuffle(others)
    .filter((r) => !r.endsWith(oku) && near(r + oku))
    .map((r) => r + oku)
    .filter((c) => c !== correct)
    .sort(bySim)

  const chosen: string[] = []
  const used = new Set<string>([correct])
  const take = (c: string | undefined): void => {
    if (c === undefined || used.has(c)) return
    used.add(c)
    chosen.push(c)
  }

  take(reals[0]) // rule 4 floor: at least one real distractor (answer is already real → ≥2 real total)
  // Rule 2: reach ≥2 near-length distractors so the answer isn't the length outlier — reals first.
  for (const c of [...reals.filter(near), ...synths]) {
    if (chosen.filter(near).length >= 2 || chosen.length >= CHOICE_DISTRACTORS) break
    take(c)
  }
  // Fill remaining slots, preferring real words (rule 4 ideal) then similarity (rule 3).
  for (const c of [...reals, ...synths]) {
    if (chosen.length >= CHOICE_DISTRACTORS) break
    take(c)
  }

  return toOptionSet(correct, chosen)
}

/** Any CJK ideograph (kanji) — excludes kana. */
const KANJI_RE = /[㐀-䶿一-鿿豈-﫿]/

/** Japanese engine logic — the reference implementation. */
export const jaEngine: LangEngine = {
  id: 'ja',
  readingOptions(correct, surface, pool) {
    return makeReadingOptions(correct, pool, okuriganaOf(surface))
  },
  nativeWhenUntracked(surface) {
    return !KANJI_RE.test(surface)
  },
}
