import type { Kanji, Sentence, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'
import { pick, sample, shuffle } from './random'

// ---------------------------------------------------------------------------
// Task model
// ---------------------------------------------------------------------------

export type TaskType = 'type-word' | 'which-words' | 'cloze' | 'pick-reading' | 'pick-meaning'

export const ALL_TASK_TYPES: TaskType[] = [
  'type-word',
  'which-words',
  'cloze',
  'pick-reading',
  'pick-meaning',
]

/**
 * The ten practice-tuning knobs — two per task type. Edit these to rebalance practice:
 *  - `weight`: how often this task type appears, relative to the others (among the types feasible
 *    for the chosen kanji). 0 disables it. Equal weights ⇒ uniform pick, the original behaviour.
 *  - `points`: how much a fully-correct answer raises the kanji's level — and a fully-wrong one
 *    lowers it. The task's raw score (−1…+1; partial credit for which-words, half on a redo) is
 *    multiplied by this. It scales **leveling only**; the Stats success rate stays pure accuracy.
 * All default to 1, which reproduces the current behaviour.
 */
export const TASK_TUNING: Record<TaskType, { weight: number; points: number }> = {
  'type-word': { weight: 1, points: 1 },
  'which-words': { weight: 1, points: 1 },
  cloze: { weight: 1, points: 1 },
  'pick-reading': { weight: 1, points: 1 },
  'pick-meaning': { weight: 1, points: 1 },
}

/** Optional context for task generation (e.g. the kanji currently in review). */
export interface TaskContext {
  /** idx values of kanji the learner is currently reviewing — preferred cloze distractors. */
  studySet?: number[]
}

export interface Option {
  label: string
  correct: boolean
}

/** T1: show a word, type its reading in kana. */
export interface TypeWordTask {
  kind: 'type-word'
  targetIdx: number
  word: string
  meaning: string
  reading: string
}

export interface WhichWordsOption {
  word: string
  reading: string
  meaning: string
  correct: boolean
}

/** T2: show a kanji, multi-select the real example words among distractors (exactly 4 options). */
export interface WhichWordsTask {
  kind: 'which-words'
  targetIdx: number
  char: string
  options: WhichWordsOption[]
}

/** Number of options in a which-words task. */
export const WHICH_WORDS_OPTIONS = 4
/** Points per option scored correctly (or lost when wrong). */
export const WHICH_WORDS_POINT = 0.25

/**
 * T3a/b/c: a sentence with one focused word token + single-choice options.
 * - cloze: hide the target kanji char (`blankChar`) in the word; options are kanji chars.
 * - pick-reading / pick-meaning: highlight the word; options are readings / meanings.
 */
export interface ChoiceTask {
  kind: 'cloze' | 'pick-reading' | 'pick-meaning'
  targetIdx: number
  sentence: Sentence
  tokenIndex: number
  /** Cloze only: the kanji char to blank out in the focus word. */
  blankChar?: string
  options: Option[]
}

/** Number of options in a cloze task. */
export const CLOZE_OPTIONS = 4

export type Task = TypeWordTask | WhichWordsTask | ChoiceTask

// ---------------------------------------------------------------------------
// Distractor pools (built once per content index)
// ---------------------------------------------------------------------------

interface Pools {
  readings: string[]
  meanings: string[]
}

const poolCache = new WeakMap<ContentIndex, Pools>()

function getPools(index: ContentIndex): Pools {
  const cached = poolCache.get(index)
  if (cached) return cached
  const readings = new Set<string>()
  const meanings = new Set<string>()
  for (const k of index.content.kanji) {
    for (const ex of k.examples) {
      readings.add(ex.reading)
      meanings.add(ex.meaning)
    }
  }
  const pools: Pools = { readings: [...readings], meanings: [...meanings] }
  poolCache.set(index, pools)
  return pools
}

const CHOICE_DISTRACTORS = 3
const MIN_CHOICE_DISTRACTORS = 2

function makeOptions(correct: string, pool: string[]): Option[] | null {
  const distractors = sample(
    pool.filter((x) => x !== correct),
    CHOICE_DISTRACTORS,
  )
  if (distractors.length < MIN_CHOICE_DISTRACTORS) return null
  return shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
}

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
 * weighted highest), shared prefix, and matching length. Higher = harder to tell apart, so knowing
 * just part of the reading (one character's sound, the length, the ending) isn't enough.
 */
function readingSimilarity(candidate: string, correct: string): number {
  return (
    2 * commonSuffixLen(candidate, correct) +
    commonPrefixLen(candidate, correct) +
    (candidate.length === correct.length ? 1 : 0)
  )
}

/** The visible okurigana: the trailing run of kana in a surface form (上手に → に, 食べる → べる, 一 → ''). */
function okuriganaOf(ja: string): string {
  // U+3040–U+30FF spans the hiragana and katakana blocks (okurigana is kana).
  return ja.match(/[぀-ヿ]+$/)?.[0] ?? ''
}

/** Wrap a correct reading + its distractors into a shuffled single-choice option set (null if too few). */
function readingOptions(correct: string, distractors: string[]): Option[] | null {
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
    return readingOptions(correct, bySimilarity(correct, pool).slice(0, CHOICE_DISTRACTORS))
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

  return readingOptions(correct, chosen)
}

/** Find a sentence containing `target` whose word token lists `target.idx` as a blankable target. */
function findFocusToken(
  target: Kanji,
  index: ContentIndex,
): { sentence: Sentence; tokenIndex: number; token: WordToken } | null {
  const sentences = index.sentencesForKanji.get(target.idx) ?? []
  for (const sentence of shuffle(sentences)) {
    const tokenIndex = sentence.tokens.findIndex(
      (t): t is WordToken => t.kind === 'word' && t.targets.includes(target.idx),
    )
    if (tokenIndex >= 0) {
      return { sentence, tokenIndex, token: sentence.tokens[tokenIndex] as WordToken }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Generators (return null when the target lacks the data for that task)
// ---------------------------------------------------------------------------

function buildTypeWord(target: Kanji): TypeWordTask | null {
  if (target.examples.length === 0) return null
  const ex = pick(target.examples)
  return {
    kind: 'type-word',
    targetIdx: target.idx,
    word: ex.word,
    meaning: ex.meaning,
    reading: ex.reading,
  }
}

function buildWhichWords(target: Kanji): WhichWordsTask | null {
  // Exactly WHICH_WORDS_OPTIONS options with ≥1 real and ≥1 fake.
  const maxReal = Math.min(WHICH_WORDS_OPTIONS - 1, target.examples.length)
  const minReal = Math.max(1, WHICH_WORDS_OPTIONS - target.distractors.length)
  if (minReal > maxReal) return null
  const realN = minReal + Math.floor(Math.random() * (maxReal - minReal + 1))
  const fakeN = WHICH_WORDS_OPTIONS - realN

  const reals = sample(target.examples, realN).map((e) => ({
    word: e.word,
    reading: e.reading,
    meaning: e.meaning,
    correct: true,
  }))
  const fakes = sample(target.distractors, fakeN).map((d) => ({
    word: d.word,
    reading: d.reading,
    meaning: d.meaning,
    correct: false,
  }))
  if (reals.length + fakes.length !== WHICH_WORDS_OPTIONS) return null
  return {
    kind: 'which-words',
    targetIdx: target.idx,
    char: target.char,
    options: shuffle([...reals, ...fakes]),
  }
}

/** Cloze: blank the target kanji char in a word; options are kanji chars. */
function buildCloze(target: Kanji, index: ContentIndex, studySet: number[]): ChoiceTask | null {
  const focus = findFocusToken(target, index)
  if (!focus) return null

  const correct = target.char
  const used = new Set<string>([correct])
  const distractors: string[] = []

  // Prefer kanji from the current study set, then fall back to random of the 100.
  const fromStudy = shuffle(
    studySet.map((i) => index.byIdx.get(i)?.char).filter((c): c is string => Boolean(c)),
  )
  const fallback = shuffle(index.content.kanji.map((k) => k.char))
  for (const c of [...fromStudy, ...fallback]) {
    if (distractors.length >= CLOZE_OPTIONS - 1) break
    if (!used.has(c)) {
      used.add(c)
      distractors.push(c)
    }
  }
  if (distractors.length < CLOZE_OPTIONS - 1) return null

  const options = shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
  return {
    kind: 'cloze',
    targetIdx: target.idx,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    blankChar: correct,
    options,
  }
}

/** pick-reading / pick-meaning: highlight a word, choose its reading / meaning. */
function buildPick(
  kind: 'pick-reading' | 'pick-meaning',
  target: Kanji,
  index: ContentIndex,
): ChoiceTask | null {
  const focus = findFocusToken(target, index)
  if (!focus) return null
  const pools = getPools(index)
  const options =
    kind === 'pick-reading'
      ? makeReadingOptions(focus.token.reading, pools.readings, okuriganaOf(focus.token.ja))
      : makeOptions(focus.token.en, pools.meanings)
  if (!options) return null
  return {
    kind,
    targetIdx: target.idx,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    options,
  }
}

/** Build a task of `type` for `targetIdx`, or null if the data doesn't support it. */
export function generateTask(
  index: ContentIndex,
  targetIdx: number,
  type: TaskType,
  ctx: TaskContext = {},
): Task | null {
  const target = index.byIdx.get(targetIdx)
  if (!target) return null
  switch (type) {
    case 'type-word':
      return buildTypeWord(target)
    case 'which-words':
      return buildWhichWords(target)
    case 'cloze':
      return buildCloze(target, index, ctx.studySet ?? [])
    case 'pick-reading':
    case 'pick-meaning':
      return buildPick(type, target, index)
  }
}

/**
 * Task types in a weighted-random order (Efraimidis–Spirakis reservoir keys): a higher
 * {@link TASK_TUNING} `weight` makes a type more likely to come first. weight 0 sorts last, so it's
 * only used when nothing else is feasible for the target. Equal weights ⇒ a uniform shuffle.
 */
function weightedTaskOrder(): TaskType[] {
  return [...ALL_TASK_TYPES]
    .map((t) => {
      const w = Math.max(0, TASK_TUNING[t].weight)
      return { t, key: w === 0 ? 0 : Math.random() ** (1 / w) }
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.t)
}

/**
 * Pick a feasible task for the target, trying task types in {@link TASK_TUNING}-weighted random order.
 * `avoid` lets the caller discourage repeating the previous type (deferred to last when possible).
 */
export function generateAnyTask(
  index: ContentIndex,
  targetIdx: number,
  ctx: TaskContext = {},
  avoid?: TaskType,
): Task | null {
  const order = weightedTaskOrder()
  if (avoid) order.sort((a, b) => (a === avoid ? 1 : 0) - (b === avoid ? 1 : 0))
  for (const type of order) {
    const task = generateTask(index, targetIdx, type, ctx)
    if (task) return task
  }
  return null
}

// ---------------------------------------------------------------------------
// Answer checking (pure, reused by UI + tests)
// ---------------------------------------------------------------------------

export function normalizeKana(s: string): string {
  return s.trim().replace(/\s+/g, '')
}

export function checkTypeWord(task: TypeWordTask, input: string): boolean {
  return normalizeKana(input) === normalizeKana(task.reading)
}

/** All options matched (real selected, fake unselected). */
export function isWhichWordsPerfect(task: WhichWordsTask, selected: Set<number>): boolean {
  return task.options.every((o, i) => o.correct === selected.has(i))
}

/**
 * Partial credit: +WHICH_WORDS_POINT for each option whose selection matches its correctness,
 * −WHICH_WORDS_POINT for each mismatch. Net ∈ [−1, +1] for 4 options.
 */
export function scoreWhichWords(task: WhichWordsTask, selected: Set<number>): number {
  return task.options.reduce(
    (sum, o, i) => sum + (o.correct === selected.has(i) ? WHICH_WORDS_POINT : -WHICH_WORDS_POINT),
    0,
  )
}

export function checkChoice(task: ChoiceTask, chosenIndex: number): boolean {
  return task.options[chosenIndex]?.correct === true
}

/** Convenience: does this kanji currently support at least one task type? */
export function hasAnyTask(index: ContentIndex, targetIdx: number): boolean {
  return ALL_TASK_TYPES.some((t) => generateTask(index, targetIdx, t) !== null)
}
