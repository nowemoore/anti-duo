// Kana *word* practice: reading whole words made of characters the learner already knows.
//
// The character drill (drill.ts) teaches sound→shape one glyph at a time. This is the next step:
// the same characters in real words, where the mistakes are long vowels, small kana and voicing
// marks rather than confusing two glyphs. Its questions come from the authored word list, so unlike
// the character drill's generated sequences, everything asked here is a real word.
//
// **The rule that governs everything below: a word is only ever shown once every character in it has
// been traced.** The chart is the curriculum, and a word containing a character the learner has not
// met is unreadable — it would be asking them to guess.
import {
  KANA_STREAK_MAX,
  KANA_WORD_ITEMS,
  KANA_WORD_OPTIONS,
  KANA_WORD_SPELL_STREAK,
} from '../../../shared/constants'
import type { KanaWord, Progress } from '../../../shared/types'
import { shuffle } from '../random'
import { streakOf, isTraced } from './engine'
import { kanaOf } from './table'

/** How a word question is answered. */
export type WordFormat = 'spell' | 'meaning'

/** One word question. */
export interface WordItem {
  word: KanaWord
  /**
   * `spell`   — the meaning is shown and the word is spoken; pick the correct spelling.
   * `meaning` — the word is shown; pick what it means.
   */
  format: WordFormat
  /** Presentation-order options; exactly one is correct. */
  options: { label: string; correct: boolean }[]
}

export interface WordDrillOptions {
  count?: number
  /** Restrict to one script. Omitted = both. */
  script?: KanaWord['script']
}

/**
 * Split a word into the chart entries it is made of, longest match first.
 *
 * Two characters at a time before one, because yōon are single chart entries: キャベツ is キャ·ベ·ツ,
 * not キ·ャ·ベ·ツ, and a learner who traced キャ never traced a bare ャ. Characters that aren't in
 * either chart — the long mark ー, the small tsu っ/ッ, and the small vowels of foreign sounds
 * (ファ, ティ) — are skipped: they are modifiers rather than glyphs to learn, and demanding them
 * would make every long katakana word permanently unreachable.
 */
export function charsOf(word: string): string[] {
  const cps = [...word]
  const out: string[] = []
  for (let i = 0; i < cps.length; i++) {
    const pair = cps[i] + (cps[i + 1] ?? '')
    if (pair.length > 1 && kanaOf(pair)) {
      out.push(pair)
      i++
    } else if (kanaOf(cps[i])) {
      out.push(cps[i])
    }
  }
  return out
}

/** Whether every chart entry this word is made of has been traced. */
export function isReadable(progress: Progress, word: KanaWord): boolean {
  const chars = charsOf(word.word)
  return chars.length > 0 && chars.every((c) => isTraced(progress, c))
}

/** Every word the learner can currently read, optionally of one script. */
export function readableWords(
  progress: Progress,
  words: KanaWord[],
  script?: KanaWord['script'],
): KanaWord[] {
  return words.filter((w) => (!script || w.script === script) && isReadable(progress, w))
}

/**
 * Whether there is enough vocabulary to practise. Needs {@link KANA_WORD_OPTIONS} readable words,
 * not one: a multiple-choice question can't be filled from a shorter list, and a question offering
 * its answer as the only option asks nothing.
 */
export function canPractiseWords(progress: Progress, words: KanaWord[]): boolean {
  return readableWords(progress, words).length >= KANA_WORD_OPTIONS
}

/** How many more words would become readable with one more character traced — for the locked state. */
export function wordsToPractise(progress: Progress, words: KanaWord[]): number {
  return Math.max(0, KANA_WORD_OPTIONS - readableWords(progress, words).length)
}

/**
 * How much this word needs practice: the weakest character in it decides.
 *
 * A word is only as readable as its worst glyph, so pulling toward the weak ones is what makes word
 * practice reinforce the chart rather than drift toward whatever happens to be easy. Same
 * squared-headroom shape as the character drill and the kanji picker, so all three behave alike.
 */
function weightOf(progress: Progress, word: KanaWord): number {
  const chars = charsOf(word.word)
  const weakest = Math.min(...chars.map((c) => streakOf(progress, c)))
  return (KANA_STREAK_MAX - weakest + 1) ** 2
}

function weightedPick(pool: KanaWord[], weights: Map<number, number>): KanaWord {
  const total = pool.reduce((n, w) => n + (weights.get(w.idx) ?? 1), 0)
  let r = Math.random() * total
  for (const w of pool) {
    r -= weights.get(w.idx) ?? 1
    if (r <= 0) return w
  }
  return pool[pool.length - 1]
}

/**
 * Options for "which spelling is right".
 *
 * The authored `distractors` are near-misses of *this* word (パーン, パソ for パン), which is exactly
 * the discrimination worth testing. They're preferred over other real words, which would turn a
 * spelling question into a vocabulary question. Real words of the same script fill any shortfall,
 * since some entries carry fewer distractors than there are option slots.
 */
export function buildSpellOptions(word: KanaWord, pool: KanaWord[]): WordItem['options'] {
  const seen = new Set([word.word])
  const chosen: string[] = []

  for (const d of shuffle(word.distractors)) {
    if (chosen.length >= KANA_WORD_OPTIONS - 1) break
    if (seen.has(d.word)) continue
    seen.add(d.word)
    chosen.push(d.word)
  }
  for (const other of shuffle(pool.filter((w) => w.script === word.script))) {
    if (chosen.length >= KANA_WORD_OPTIONS - 1) break
    if (seen.has(other.word)) continue
    seen.add(other.word)
    chosen.push(other.word)
  }

  return shuffle([
    { label: word.word, correct: true },
    ...chosen.map((c) => ({ label: c, correct: false })),
  ])
}

/**
 * Options for "what does this mean". Distractors are other words' glosses, drawn from the same
 * category first so the choice is between plausible neighbours (four animals) rather than between
 * one animal and three unrelated things.
 */
export function buildMeaningOptions(word: KanaWord, pool: KanaWord[]): WordItem['options'] {
  const answer = word.gloss[0] ?? ''
  const seen = new Set([answer])
  const chosen: string[] = []

  const sameCategory = pool.filter((w) => w.category === word.category && w.idx !== word.idx)
  const rest = pool.filter((w) => w.category !== word.category)
  for (const other of [...shuffle(sameCategory), ...shuffle(rest)]) {
    if (chosen.length >= KANA_WORD_OPTIONS - 1) break
    const gloss = other.gloss[0]
    if (!gloss || seen.has(gloss)) continue
    seen.add(gloss)
    chosen.push(gloss)
  }

  return shuffle([
    { label: answer, correct: true },
    ...chosen.map((c) => ({ label: c, correct: false })),
  ])
}

/**
 * Which way round to ask.
 *
 * Meaning-first while the word is new, because being shown the word and asked what it means is the
 * gentler direction — the answer is in front of you. Spelling once its characters are solid, since
 * producing the right long vowel from a sound is the harder half and only worth asking when the
 * glyphs themselves aren't still in question.
 */
export function formatForWord(progress: Progress, word: KanaWord): WordFormat {
  const chars = charsOf(word.word)
  const weakest = Math.min(...chars.map((c) => streakOf(progress, c)))
  return weakest >= KANA_WORD_SPELL_STREAK ? 'spell' : 'meaning'
}

/**
 * Build one word-practice run.
 *
 * Only words whose every character has been traced are ever drawn — see {@link isReadable}. Within
 * that, weak characters pull their words up, and each word is used once before any repeats.
 */
export function buildWordDrill(
  progress: Progress,
  words: KanaWord[],
  { count = KANA_WORD_ITEMS, script }: WordDrillOptions = {},
): WordItem[] {
  const pool = readableWords(progress, words, script)
  if (pool.length < KANA_WORD_OPTIONS) return []

  const weights = new Map(pool.map((w) => [w.idx, weightOf(progress, w)]))
  const items: WordItem[] = []
  const used = new Set<number>()

  for (let n = 0; n < count; n++) {
    const remaining = pool.filter((w) => !used.has(w.idx))
    const word = weightedPick(remaining.length ? remaining : pool, weights)
    if (remaining.length) used.add(word.idx)
    else used.clear()

    const format = formatForWord(progress, word)
    items.push({
      word,
      format,
      options:
        format === 'spell' ? buildSpellOptions(word, pool) : buildMeaningOptions(word, pool),
    })
  }
  return items
}

// ---------------------------------------------------------------------------
// Browsing filters
// ---------------------------------------------------------------------------

/**
 * Neither set = every word. An empty array (or null) is "no filter", never "unknown".
 *
 * Lists rather than single values, for the same reason as the kanji board's: choosing a second topic
 * should add to the view, not replace what you chose first.
 */
export interface KanaWordFilters {
  script?: KanaWord['script'][] | null
  category?: string[] | null
}

/** Whether a value passes one filter. An unset or empty filter passes everything. */
function passes(chosen: readonly string[] | null | undefined, value: string): boolean {
  return !chosen || chosen.length === 0 || chosen.includes(value)
}

/** A filter option and how many words it covers, so a picker can show its own counts. */
export interface KanaFilterOption {
  value: string
  count: number
}

/** The words a browser should show, narrowed by whichever filters are set. */
export function filterKanaWords(words: KanaWord[], filters: KanaWordFilters = {}): KanaWord[] {
  return words.filter((w) => passes(filters.script, w.script) && passes(filters.category, w.category))
}

/**
 * Script options, counted against the *other* filter — pick a topic and each script shows how many
 * of that topic's words it holds, so the two read as one query rather than two.
 */
export function kanaScriptOptions(
  words: KanaWord[],
  filters: KanaWordFilters = {},
): KanaFilterOption[] {
  const counts = new Map<string, number>()
  for (const w of filterKanaWords(words, { category: filters.category })) {
    counts.set(w.script, (counts.get(w.script) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count }))
}

/** Topic options, commonest first — the same reasoning as the kanji board's radical list. */
export function kanaCategoryOptions(
  words: KanaWord[],
  filters: KanaWordFilters = {},
): KanaFilterOption[] {
  const counts = new Map<string, number>()
  for (const w of filterKanaWords(words, { script: filters.script })) {
    counts.set(w.category, (counts.get(w.category) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}
