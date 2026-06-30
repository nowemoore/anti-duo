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

/**
 * Reading options whose distractors are the most confusable readings in the pool (by
 * {@link readingSimilarity}), randomised within equal-similarity groups.
 */
function makeReadingOptions(correct: string, pool: string[]): Option[] | null {
  const ranked = shuffle(pool.filter((x) => x !== correct)).sort(
    (a, b) => readingSimilarity(b, correct) - readingSimilarity(a, correct),
  )
  const distractors = ranked.slice(0, CHOICE_DISTRACTORS)
  if (distractors.length < MIN_CHOICE_DISTRACTORS) return null
  return shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
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
      ? makeReadingOptions(focus.token.reading, pools.readings)
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
 * Pick a feasible task for the target, trying task types in random order.
 * `avoid` lets the caller discourage repeating the previous type.
 */
export function generateAnyTask(
  index: ContentIndex,
  targetIdx: number,
  ctx: TaskContext = {},
  avoid?: TaskType,
): Task | null {
  const order = shuffle(ALL_TASK_TYPES)
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
