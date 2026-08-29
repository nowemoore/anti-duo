// Practice questions whose target is a *kana word* rather than a kanji unit.
//
// Why a separate module rather than more entries in tasks.ts: the six kanji tasks all start from a
// `Unit` — a character with a level, example words and a stroke order — and a kana word has none of
// that. It is already the word, it has no unit behind it, and what makes it hard is spelling rather
// than reading. So the roster differs in kind, not just in size:
//
//   - type the word / pick the reading are meaningless — the surface *is* the reading;
//   - which-words is structurally kanji-only, since it asks what is built on a character;
//   - spelling (long vowels, small kana, voicing) is the real difficulty, and no kanji task tests it.
//
// Scoring differs too. A kanji task moves a unit's level; these move the word's own run in
// `Progress.words` and the character runs in the kana chart, because that is where a kana word's
// progress actually lives. See `scoreKanaAnswer`.
import type { KanaWord, Progress, Sentence, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'
import { pick, shuffle } from './random'
import {
  buildMeaningOptions,
  buildSpellOptions,
  charsOf,
  markWordMet,
  recordResult,
} from './kana'
import { recordWordResult } from './stats'
import { KANA_TASK_OPTIONS, KANA_TASK_TYPES, type KanaTaskType } from './kanaTaskTypes'

export * from './kanaTaskTypes'

export interface KanaOption {
  label: string
  correct: boolean
}

/**
 * One question about a kana word.
 *
 * `kana-spell` stands alone (the meaning is the prompt); the other two need a sentence, and carry
 * the one they chose plus the index of the token being asked about.
 */
export interface KanaTask {
  kind: KanaTaskType
  /** The kana word's own idx — the kana equivalent of a task's `targetIdx`. */
  kanaIdx: number
  word: KanaWord
  /** Absent for `kana-spell`, which asks about the word on its own. */
  sentence?: Sentence
  tokenIndex?: number
  options: KanaOption[]
}

/** Every other kana word — the pool both option builders draw their wrong answers from. */
function otherWords(index: ContentIndex, word: KanaWord): KanaWord[] {
  return (index.content.kanaWords ?? []).filter((w) => w.idx !== word.idx)
}

/**
 * Pick the correct spelling of a word whose meaning you're shown.
 *
 * Options come from the kana course's own builder, so a question asked here is the question asked in
 * the word drill: near-miss spellings from the word's `distractors` column first (パーン, バン for
 * パン — exactly the mistakes this exists to catch), topped up from other words of the same script
 * for the eight words that have none authored.
 */
export function buildKanaSpell(word: KanaWord, index: ContentIndex): KanaTask | null {
  const options = buildSpellOptions(word, otherWords(index, word))
  if (options.length < KANA_TASK_OPTIONS) return null
  return { kind: 'kana-spell', kanaIdx: word.idx, word, options }
}

/** A sentence containing this word, and the index of the token that is it. */
function focusToken(
  word: KanaWord,
  index: ContentIndex,
): { sentence: Sentence; tokenIndex: number } | null {
  for (const sentence of shuffle(index.sentencesForKanaWord.get(word.idx) ?? [])) {
    const tokenIndex = sentence.tokens.findIndex(
      (t): t is WordToken => t.kind === 'word' && (t.kanaTargets?.includes(word.idx) ?? false),
    )
    if (tokenIndex >= 0) return { sentence, tokenIndex }
  }
  return null
}

/**
 * The word highlighted in a sentence: what does it mean?
 *
 * Wrong answers are drawn from the same topic first (the course's own builder does this), so the
 * choice is between four plausible Dining words rather than between a food and a verb.
 */
export function buildKanaMeaning(word: KanaWord, index: ContentIndex): KanaTask | null {
  const focus = focusToken(word, index)
  if (!focus) return null
  if (!word.gloss[0]) return null
  const options = buildMeaningOptions(word, otherWords(index, word))
  if (options.length < KANA_TASK_OPTIONS) return null
  return {
    kind: 'kana-meaning',
    kanaIdx: word.idx,
    word,
    sentence: focus.sentence,
    tokenIndex: focus.tokenIndex,
    options,
  }
}

/**
 * The word blanked out of a sentence: which spelling fills the gap?
 *
 * The spelling question again, but with the sentence carrying the meaning — so the learner is
 * choosing between パン and バン knowing what the sentence is about, which is how the mistake
 * actually presents itself in reading.
 */
export function buildKanaCloze(word: KanaWord, index: ContentIndex): KanaTask | null {
  const focus = focusToken(word, index)
  if (!focus) return null
  const spell = buildKanaSpell(word, index)
  if (!spell) return null
  return { ...spell, kind: 'kana-cloze', sentence: focus.sentence, tokenIndex: focus.tokenIndex }
}

const BUILDERS: Record<KanaTaskType, (w: KanaWord, i: ContentIndex) => KanaTask | null> = {
  'kana-spell': buildKanaSpell,
  'kana-meaning': buildKanaMeaning,
  'kana-cloze': buildKanaCloze,
}

/**
 * A question about this word, of whichever kind the data supports — tried in a random order, so a
 * word with sentences doesn't always get the same one.
 */
export function generateKanaTask(
  index: ContentIndex,
  kanaIdx: number,
  avoid?: KanaTaskType,
): KanaTask | null {
  const word = (index.content.kanaWords ?? []).find((w) => w.idx === kanaIdx)
  if (!word) return null
  const order = shuffle([...KANA_TASK_TYPES])
  if (avoid) order.sort((a, b) => (a === avoid ? 1 : 0) - (b === avoid ? 1 : 0))
  for (const kind of order) {
    const task = BUILDERS[kind](word, index)
    if (task) return task
  }
  return null
}

/** Whether this word can be asked about at all — drives whether it may be picked as a target. */
export function hasKanaTask(index: ContentIndex, kanaIdx: number): boolean {
  return generateKanaTask(index, kanaIdx) != null
}

/**
 * Record an answer to a kana question.
 *
 * Three ledgers, each getting what it is about: the characters' runs (reading パン right is evidence
 * for パ and ン), the word's own run in `Progress.words` (the same one every kanji word rides), and
 * `met` on a correct answer. No unit level is touched — a kana word has no unit.
 */
export function scoreKanaAnswer(
  progress: Progress,
  word: KanaWord,
  correct: boolean,
  now: string,
): Progress {
  let next = recordResult(progress, charsOf(word.word), correct)
  next = recordWordResult(next, word.word, correct)
  return correct ? markWordMet(next, word.idx, now) : next
}

/** A random kana word that can be asked about, or null when none can. */
export function pickKanaTarget(index: ContentIndex, eligible: KanaWord[]): KanaWord | null {
  const pool = eligible.filter((w) => hasKanaTask(index, w.idx))
  return pool.length ? pick(pool) : null
}
