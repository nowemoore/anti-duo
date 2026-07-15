import type { Unit, Word, Sentence, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'
import { pick, sample, shuffle } from './random'

// ---------------------------------------------------------------------------
// Task model
// ---------------------------------------------------------------------------

export type TaskType =
  | 'type-word'
  | 'which-words'
  | 'cloze'
  | 'root-cloze'
  | 'pick-reading'
  | 'pick-meaning'
  | 'draw'
  | 'plural'

// The task roster (ALL_TASK_TYPES), tuning (TASK_TUNING), and labels (stats.ts TASK_LABELS) all derive
// from the TASK_SPECS registry defined below (after the generators). A TaskSpec is the engine half of a
// task; the mobile half (the TaskUI: view, answer widget, grading) is registered separately by kind.

/** Optional context for task generation (e.g. the unit currently in review). */
export interface TaskContext {
  /** idx values of units the learner is currently reviewing — preferred cloze distractors. */
  studySet?: number[]
  /** Per-task appearance weight override (keyed by TaskType); falls back to {@link TASK_TUNING}. */
  taskWeights?: Record<string, number>
  /**
   * The task types the active language offers (from its LanguagePack). Defaults to all when unset,
   * so the web demo and existing callers are unaffected.
   */
  tasks?: TaskType[]
  /**
   * Whether a word can be an auto-graded draw target. Only the mobile client (which has the
   * handwriting recognizer) passes this; its presence is what enables 'draw' generation, so
   * the web app never produces a draw task it can't render.
   */
  canDraw?: (word: string) => boolean
  /**
   * The learner's current level for a unit. Languages that stage their example words (Arabic tags each
   * with `extra.batch`) use it to release one batch at a time. Omit it and every example is available.
   */
  levelOf?: (targetIdx: number) => number
}

// ---------------------------------------------------------------------------
// Staged word release (languages whose content tags words with `extra.batch`)
// ---------------------------------------------------------------------------

/** Levels of practice between each further batch of a unit's words being released. */
export const BATCH_UNLOCK_EVERY = 3

/** How many of a unit's word-batches are released at `lvl` (1 = only the first batch). */
export function batchesUnlocked(lvl: number): number {
  return 1 + Math.max(0, Math.floor((lvl - 1) / BATCH_UNLOCK_EVERY))
}

/**
 * The example words currently released for a unit. Arabic stages its words (`extra.batch`), so a root
 * starts with its first batch and reveals the next as it's levelled up. Japanese doesn't stage words,
 * and callers with no level info (tests, the web demo) get every example — so this is a no-op there.
 */
export function releasedExamples(target: Unit, ctx: TaskContext = {}): Word[] {
  const staged = target.examples.some((e) => typeof e.extra?.batch === 'number')
  if (!staged || !ctx.levelOf) return target.examples
  const unlocked = batchesUnlocked(ctx.levelOf(target.idx))
  const out = target.examples.filter((e) => ((e.extra?.batch as number) ?? 1) <= unlocked)
  // Never strand a unit with nothing to practise.
  return out.length ? out : target.examples.slice(0, 1)
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
  /** Extra answers graded as correct (e.g. Arabic spelling variants from `word.extra.accept`). */
  accept?: string[]
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
  form: string
  options: WhichWordsOption[]
}

/** Number of options in a which-words task. */
export const WHICH_WORDS_OPTIONS = 4
/** Points per option scored correctly (or lost when wrong). */
export const WHICH_WORDS_POINT = 0.25

/**
 * T3a/b/c: a sentence with one focused word token + single-choice options.
 * - cloze: hide the target unit char (`blankChar`) in the word; options are unit forms.
 * - root-cloze: hide the whole focus word; options are unit forms (which root fills the slot?).
 * - pick-reading / pick-meaning: highlight the word; options are readings / meanings.
 */
export interface ChoiceTask {
  kind: 'cloze' | 'root-cloze' | 'pick-reading' | 'pick-meaning'
  targetIdx: number
  sentence: Sentence
  tokenIndex: number
  /** Cloze only: the unit char to blank out in the focus word (root-cloze blanks the whole word). */
  blankChar?: string
  options: Option[]
}

/** Number of options in a cloze task. */
export const CLOZE_OPTIONS = 4

/** T4: draw a word (all kanji, ≤3 chars) from its reading. Graded on-device by the recognizer. */
export interface DrawTask {
  kind: 'draw'
  targetIdx: number
  /** The word to draw (kanji only). */
  word: string
  /** Kana reading shown as the prompt (empty when the target is a bare kanji). */
  reading: string
  meaning: string
}

/** Max characters in a drawable word (kept short so guided segmentation stays reliable). */
export const DRAW_MAX_CHARS = 3

/**
 * Singular ↔ plural: shows a word's singular and plural (voweled), with one of the two blanked out;
 * choose the missing form. `ask` says which line is blank (= the answer). Data-driven.
 */
export interface PluralTask {
  kind: 'plural'
  targetIdx: number
  singular: string
  plural: string
  meaning: string
  ask: 'singular' | 'plural'
  options: Option[]
}

export type Task = TypeWordTask | WhichWordsTask | ChoiceTask | DrawTask | PluralTask

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
  for (const k of index.content.units) {
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

/** Find a sentence containing `target` whose word token lists `target.idx` as a blankable target. */
function findFocusToken(
  target: Unit,
  index: ContentIndex,
): { sentence: Sentence; tokenIndex: number; token: WordToken } | null {
  const sentences = index.sentencesForUnit.get(target.idx) ?? []
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

function buildTypeWord(target: Unit, ctx: TaskContext): TypeWordTask | null {
  const examples = releasedExamples(target, ctx)
  if (examples.length === 0) return null
  const ex = pick(examples)
  const accept = Array.isArray(ex.extra?.accept)
    ? (ex.extra.accept as unknown[]).filter((a): a is string => typeof a === 'string')
    : undefined
  return {
    kind: 'type-word',
    targetIdx: target.idx,
    word: ex.word,
    meaning: ex.meaning,
    reading: ex.reading,
    ...(accept?.length ? { accept } : {}),
  }
}

function buildWhichWords(target: Unit, ctx: TaskContext): WhichWordsTask | null {
  const examples = releasedExamples(target, ctx)
  // Exactly WHICH_WORDS_OPTIONS options with ≥1 real and ≥1 fake.
  const maxReal = Math.min(WHICH_WORDS_OPTIONS - 1, examples.length)
  const minReal = Math.max(1, WHICH_WORDS_OPTIONS - target.distractors.length)
  if (minReal > maxReal) return null
  const realN = minReal + Math.floor(Math.random() * (maxReal - minReal + 1))
  const fakeN = WHICH_WORDS_OPTIONS - realN

  const reals = sample(examples, realN).map((e) => ({
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
    form: target.form,
    options: shuffle([...reals, ...fakes]),
  }
}

/** Option set for a cloze/root-cloze: the target's form as answer, other unit forms as distractors. */
function formOptions(target: Unit, index: ContentIndex, studySet: number[]): Option[] | null {
  const correct = target.form
  const used = new Set<string>([correct])
  const distractors: string[] = []

  // Prefer forms from the current study set, then fall back to random across the curriculum.
  const fromStudy = shuffle(
    studySet.map((i) => index.byIdx.get(i)?.form).filter((c): c is string => Boolean(c)),
  )
  const fallback = shuffle(index.content.units.map((k) => k.form))
  for (const c of [...fromStudy, ...fallback]) {
    if (distractors.length >= CLOZE_OPTIONS - 1) break
    if (!used.has(c)) {
      used.add(c)
      distractors.push(c)
    }
  }
  if (distractors.length < CLOZE_OPTIONS - 1) return null

  return shuffle([
    { label: correct, correct: true },
    ...distractors.map((label) => ({ label, correct: false })),
  ])
}

/** Cloze: blank the target unit char in a word; options are unit forms (JA: single kanji). */
function buildCloze(target: Unit, index: ContentIndex, studySet: number[]): ChoiceTask | null {
  const focus = findFocusToken(target, index)
  if (!focus) return null
  const options = formOptions(target, index, studySet)
  if (!options) return null
  return {
    kind: 'cloze',
    targetIdx: target.idx,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    blankChar: target.form,
    options,
  }
}

/**
 * Root-cloze: blank the *whole* focus word in a sentence and ask which unit form (root) fills it.
 * Fits languages whose unit isn't a contiguous glyph in the surface (Arabic's non-adjacent root
 * consonants), where the single-char blank of {@link buildCloze} doesn't apply.
 */
function buildRootCloze(target: Unit, index: ContentIndex, studySet: number[]): ChoiceTask | null {
  const focus = findFocusToken(target, index)
  if (!focus) return null
  const options = formOptions(target, index, studySet)
  if (!options) return null
  return {
    kind: 'root-cloze',
    targetIdx: target.idx,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    options,
  }
}

/** pick-reading / pick-meaning: highlight a word, choose its reading / meaning. */
function buildPick(
  kind: 'pick-reading' | 'pick-meaning',
  target: Unit,
  index: ContentIndex,
): ChoiceTask | null {
  const focus = findFocusToken(target, index)
  if (!focus) return null
  const pools = getPools(index)
  const options =
    kind === 'pick-reading'
      ? index.lang.readingOptions(focus.token.reading, focus.token.surface, pools.readings)
      : makeOptions(focus.token.gloss, pools.meanings)
  if (!options) return null
  return {
    kind,
    targetIdx: target.idx,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    options,
  }
}

const KANJI_ONLY = /^[一-鿿]+$/

/** T4: an all-kanji, short word (or the bare kanji) to draw. Prefers words the caller can grade. */
function buildDraw(target: Unit, ctx: TaskContext): DrawTask | null {
  const ok = (w: string) =>
    ctx.canDraw ? ctx.canDraw(w) : KANJI_ONLY.test(w) && [...w].length <= DRAW_MAX_CHARS
  const words = target.examples.filter((e) => ok(e.word))
  if (words.length) {
    const ex = words[Math.floor(Math.random() * words.length)]
    return { kind: 'draw', targetIdx: target.idx, word: ex.word, reading: ex.reading, meaning: ex.meaning }
  }
  if (ok(target.form)) {
    return { kind: 'draw', targetIdx: target.idx, word: target.form, reading: '', meaning: target.gloss.join(', ') }
  }
  return null
}

/**
 * A "pick the plural" task: any language whose content tags example words with a plural
 * (`word.extra.plural`) gets this — the engine stays language-blind. Japanese tags none, so this
 * yields null and the task never appears. Broken plurals (Arabic) are the motivating case.
 */
function buildPlural(target: Unit, index: ContentIndex, ctx: TaskContext): Task | null {
  const withPlural = releasedExamples(target, ctx).filter((e) => typeof e.extra?.plural === 'string')
  if (!withPlural.length) return null
  const ex = pick(withPlural)
  const voweled = (bare: string, v: unknown) => (typeof v === 'string' ? v : bare)
  const singular = ex.reading || ex.word
  const plural = voweled(ex.extra!.plural as string, ex.extra!.pluralVoweled)
  // Blank either the singular or the plural, and ask for the missing one.
  const ask: 'singular' | 'plural' = Math.random() < 0.5 ? 'plural' : 'singular'
  const correct = ask === 'plural' ? plural : singular

  // Distractors are the same kind of form (voweled) drawn from other words.
  const pool = new Set<string>()
  for (const u of index.content.units) {
    for (const w of u.examples) {
      if (ask === 'plural') {
        if (typeof w.extra?.plural === 'string') pool.add(voweled(w.extra.plural, w.extra.pluralVoweled))
      } else {
        pool.add(w.reading || w.word)
      }
    }
  }
  pool.delete(correct)
  const options = makeOptions(correct, [...pool])
  if (!options) return null
  return { kind: 'plural', targetIdx: target.idx, singular, plural, meaning: ex.meaning, ask, options }
}

// ---------------------------------------------------------------------------
// Task registry — each task's kind, label, tuning, and generator in one place
// ---------------------------------------------------------------------------

/**
 * The engine half of a task type: how often it appears (`weight`), its reward/penalty when right/wrong
 * (`pointsUp`/`pointsDown`, multiplied into the ±1 raw score — so drawing can reward a lot yet barely
 * penalize a miss), its Stats/Manual `label`, and how to `generate` an instance. The mobile half (the
 * view, answer widget, and grading) is a separate TaskUI registered under the same `kind`.
 */
export interface TaskSpec {
  kind: TaskType
  label: string
  tuning: { weight: number; pointsUp: number; pointsDown: number }
  generate: (index: ContentIndex, targetIdx: number, ctx: TaskContext) => Task | null
  /** Opt-in: kept out of the default roster; a language must list it in its pack's `tasks` to offer it. */
  optIn?: boolean
}

/** Wrap a target-based generator into a spec's (index, targetIdx, ctx) → Task shape. */
function spec(
  kind: TaskType,
  label: string,
  tuning: TaskSpec['tuning'],
  build: (target: Unit, index: ContentIndex, ctx: TaskContext) => Task | null,
  optIn = false,
): TaskSpec {
  return {
    kind,
    label,
    tuning,
    optIn,
    generate: (index, targetIdx, ctx) => {
      const target = index.byIdx.get(targetIdx)
      return target ? build(target, index, ctx) : null
    },
  }
}

export const TASK_SPECS: TaskSpec[] = [
  spec('type-word', 'Type the reading', { weight: 1, pointsUp: 0.8, pointsDown: 0.4 }, (t, _i, c) => buildTypeWord(t, c)),
  spec('which-words', 'Which words are real', { weight: 1, pointsUp: 0.5, pointsDown: 0.5 }, (t, _i, c) => buildWhichWords(t, c)),
  spec('cloze', 'Fill in the blank', { weight: 1, pointsUp: 0.7, pointsDown: 0.7 }, (t, i, c) => buildCloze(t, i, c.studySet ?? [])),
  // Opt-in: languages whose unit isn't a contiguous glyph (Arabic roots) offer this instead of cloze.
  spec('root-cloze', 'Fill in the root', { weight: 1, pointsUp: 0.7, pointsDown: 0.7 }, (t, i, c) => buildRootCloze(t, i, c.studySet ?? []), true),
  spec('pick-reading', 'Pick the reading', { weight: 1, pointsUp: 0.7, pointsDown: 0.7 }, (t, i) => buildPick('pick-reading', t, i)),
  spec('pick-meaning', 'Pick the meaning', { weight: 1, pointsUp: 0.5, pointsDown: 0.5 }, (t, i) => buildPick('pick-meaning', t, i)),
  // Drawing is the hardest task: reward it strongly when right, penalize a miss only lightly.
  spec('draw', 'Draw the word', { weight: 1, pointsUp: 1, pointsDown: 0.2 }, (t, _i, c) => buildDraw(t, c)),
  // Opt-in + data-driven: only languages whose content tags plurals (word.extra.plural) offer it.
  spec('plural', 'Pick the plural', { weight: 1, pointsUp: 0.7, pointsDown: 0.7 }, (t, i, c) => buildPlural(t, i, c), true),
]

const SPEC_BY_KIND: Record<string, TaskSpec> = Object.fromEntries(TASK_SPECS.map((s) => [s.kind, s]))

/** The default task roster (opt-in tasks like plural are excluded unless a language lists them). */
export const ALL_TASK_TYPES: TaskType[] = TASK_SPECS.filter((s) => !s.optIn).map((s) => s.kind)

/** Per-task tuning (appearance weight + reward/penalty), keyed by kind — derived from {@link TASK_SPECS}. */
export const TASK_TUNING = Object.fromEntries(TASK_SPECS.map((s) => [s.kind, s.tuning])) as Record<
  TaskType,
  TaskSpec['tuning']
>

/** Build a task of `type` for `targetIdx`, or null if the data doesn't support it. */
export function generateTask(
  index: ContentIndex,
  targetIdx: number,
  type: TaskType,
  ctx: TaskContext = {},
): Task | null {
  return SPEC_BY_KIND[type]?.generate(index, targetIdx, ctx) ?? null
}

/**
 * Task types in a weighted-random order (Efraimidis–Spirakis reservoir keys): a higher `weightOf`
 * makes a type more likely to come first. weight 0 sorts last, so it's only used when nothing else
 * is feasible for the target. Equal weights ⇒ a uniform shuffle.
 */
function weightedTaskOrder(types: TaskType[], weightOf: (t: TaskType) => number): TaskType[] {
  return [...types]
    .map((t) => {
      const w = Math.max(0, weightOf(t))
      return { t, key: w === 0 ? 0 : Math.random() ** (1 / w) }
    })
    .sort((a, b) => b.key - a.key)
    .map((x) => x.t)
}

/**
 * Pick a feasible task for the target, trying task types in weighted-random order. The weight is the
 * per-user override from `ctx.taskWeights` if set, else the built-in {@link TASK_TUNING} default.
 * `avoid` lets the caller discourage repeating the previous type (deferred to last when possible).
 */
export function generateAnyTask(
  index: ContentIndex,
  targetIdx: number,
  ctx: TaskContext = {},
  avoid?: TaskType,
): Task | null {
  // The active language's task list (all by default), minus draw unless the caller can grade it
  // (the recognizer is mobile-only, and non-JA packs simply omit it from `ctx.tasks`).
  const offered = ctx.tasks ?? ALL_TASK_TYPES
  const types = ctx.canDraw ? offered : offered.filter((t) => t !== 'draw')
  const weightOf = (t: TaskType): number => ctx.taskWeights?.[t] ?? TASK_TUNING[t].weight
  const order = weightedTaskOrder(types, weightOf)
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

/**
 * Grade a typed answer against the reading and any accepted alternates. `normalize` is the language's
 * canonicaliser (JA: identity — input is already kana; AR: strip harakat so voweled ≡ bare), applied
 * to both sides before comparison.
 */
export function checkTypeWord(
  task: TypeWordTask,
  input: string,
  normalize: (s: string) => string = (s) => s,
): boolean {
  const norm = (s: string) => normalizeKana(normalize(s))
  const target = norm(input)
  return [task.reading, ...(task.accept ?? [])].some((a) => norm(a) === target)
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
  // draw needs the mobile recognizer, so a kanji is "practicable" on the strength of the
  // standard task types alone.
  return ALL_TASK_TYPES.filter((t) => t !== 'draw').some(
    (t) => generateTask(index, targetIdx, t) !== null,
  )
}
