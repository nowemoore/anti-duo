// Practice generation: what to play, in which format, and — the part that has to be right — which
// distractors are safe to show alongside the answer.
import {
  KANA_DRILL_ITEMS,
  KANA_PICK_OPTIONS,
  KANA_RECALL_STREAK,
  KANA_SEQUENCE_MAX,
  KANA_SEQUENCE_MIN_POOL,
  KANA_SEQUENCE_SHARE,
  KANA_STREAK_MAX,
} from '../../../shared/constants'
import type { Progress } from '../../../shared/types'
import { pick, shuffle } from '../random'
import { streakOf, tracedChars } from './engine'
import { CONFUSABLE, kanaOf, sameSound, soundOf, soundOfSequence } from './table'

/** How a question is answered. */
export type DrillFormat = 'pick' | 'draw'

/** One question. The sound is always played; the characters are what's being tested. */
export interface DrillItem {
  /** The characters, in order. One entry for a single, two or three for a sequence. */
  chars: string[]
  /** The whole target as one string, for display and speech. */
  target: string
  format: DrillFormat
  /** Presentation-order options for a 'pick' question; exactly one is correct. Empty otherwise. */
  options: { label: string; correct: boolean }[]
}

export interface DrillOptions {
  count?: number
  /** Restrict to one script's characters. Omitted = everything met. */
  only?: (char: string) => boolean
}

/** The vowel a syllable ends on ('kyo' → 'o'), or '' for ん. */
function vowelOf(romaji: string): string {
  return romaji.match(/[aeiou]$/)?.[0] ?? ''
}

/** The consonant a syllable opens with ('kyo' → 'ky', 'a' → ''). */
function onsetOf(romaji: string): string {
  return romaji.replace(/[aeiou]$/, '')
}

/**
 * Weight for how much this character needs practice: weak ones come up far more often. Same
 * squared-headroom shape as `pickTarget` uses for kanji levels, so the two schedulers behave alike.
 */
function weightOf(progress: Progress, char: string): number {
  return (KANA_STREAK_MAX - streakOf(progress, char) + 1) ** 2
}

function weightedPick(pool: string[], weights: Map<string, number>): string {
  const total = pool.reduce((n, c) => n + (weights.get(c) ?? 1), 0)
  let r = Math.random() * total
  for (const c of pool) {
    r -= weights.get(c) ?? 1
    if (r <= 0) return c
  }
  return pool[pool.length - 1]
}

/**
 * Options for a listen-and-pick question.
 *
 * The hard rule: **no two options may sound the same**. Japanese has genuine homophone pairs
 * (お/を, じ/ぢ, ず/づ) and every katakana duplicates a hiragana sound, so a naive draw can produce a
 * question with two correct answers. Beyond that it's a preference ordering — visually confusable
 * characters first, then ones sharing a vowel or an onset — because a question whose distractors
 * look nothing like the answer teaches nothing.
 */
export function buildOptions(char: string, pool: string[]): DrillItem['options'] {
  const romajiOf = (c: string): string => kanaOf(c)?.romaji ?? ''
  const answerRomaji = romajiOf(char)
  const confusable = new Set(CONFUSABLE.get(char) ?? [])

  const rank = (c: string): number => {
    if (confusable.has(c)) return 0
    const r = romajiOf(c)
    if (onsetOf(r) === onsetOf(answerRomaji)) return 1
    if (vowelOf(r) === vowelOf(answerRomaji)) return 2
    return 3
  }

  // Rank first, then take greedily — so deduping never discards a good distractor in favour of an
  // arbitrary earlier one that happens to share its sound.
  const ranked = shuffle(pool.filter((c) => c !== char && !sameSound(c, char))).sort(
    (a, b) => rank(a) - rank(b),
  )

  const seen = new Set([soundOf(char)])
  const chosen: string[] = []
  for (const c of ranked) {
    if (chosen.length >= KANA_PICK_OPTIONS - 1) break
    // Two distractors that sound alike aren't wrong, but they read as a second right answer.
    if (seen.has(soundOf(c))) continue
    seen.add(soundOf(c))
    chosen.push(c)
  }

  return shuffle([{ label: char, correct: true }, ...chosen.map((c) => ({ label: c, correct: false }))])
}

/**
 * Options for a sequence question: near-misses built by swapping exactly one character of the
 * answer, so the learner has to have heard the whole thing rather than just its shape. Falls back
 * to swapping a different position when one position can't produce enough distinct sounds.
 */
export function buildSequenceOptions(chars: string[], pool: string[]): DrillItem['options'] {
  const answer = chars.join('')
  const seen = new Set([soundOfSequence(chars)])
  const chosen: string[] = []

  // Try each position in turn, repeatedly, until there are enough options or nothing new is left.
  for (let round = 0; round < chars.length && chosen.length < KANA_PICK_OPTIONS - 1; round++) {
    for (let i = 0; i < chars.length && chosen.length < KANA_PICK_OPTIONS - 1; i++) {
      const swaps = shuffle(pool.filter((c) => !sameSound(c, chars[i])))
      for (const swap of swaps) {
        const variant = [...chars]
        variant[i] = swap
        const sound = soundOfSequence(variant)
        if (seen.has(sound)) continue
        seen.add(sound)
        chosen.push(variant.join(''))
        break
      }
    }
  }

  return shuffle([
    { label: answer, correct: true },
    ...chosen.map((c) => ({ label: c, correct: false })),
  ])
}

/**
 * Which format to ask a target in.
 *
 * Recognition until there's evidence the sound→shape link exists, then writing it from memory.
 * Sequences stay on recognition however well known their characters are: three characters on one
 * canvas is a handwriting exercise rather than a listening one.
 */
function formatFor(progress: Progress, chars: string[]): DrillFormat {
  if (chars.length > 1) return 'pick'
  return streakOf(progress, chars[0]) < KANA_RECALL_STREAK ? 'pick' : 'draw'
}

/**
 * Build one practice run.
 *
 * The pool is every character the learner has traced in the chart — never the whole script — so
 * practice can only ever ask about characters they chose to meet.
 *
 * Sequences are random strings of traced characters. They're not built from a word list: any real
 * word that falls out is a bonus, not the goal, and generating them means they work from the moment
 * two characters have been traced.
 */
export function buildDrill(
  progress: Progress,
  { count = KANA_DRILL_ITEMS, only }: DrillOptions = {},
): DrillItem[] {
  const pool = tracedChars(progress).filter((c) => (only ? only(c) : true))
  if (pool.length === 0) return []

  const weights = new Map(pool.map((c) => [c, weightOf(progress, c)]))
  const canSequence = pool.length >= KANA_SEQUENCE_MIN_POOL

  const items: DrillItem[] = []
  const usedSingles = new Set<string>()

  for (let n = 0; n < count; n++) {
    const asSequence = canSequence && Math.random() < KANA_SEQUENCE_SHARE

    if (asSequence) {
      const len = 2 + Math.floor(Math.random() * (KANA_SEQUENCE_MAX - 1))
      const chars: string[] = []
      for (let i = 0; i < len; i++) {
        // Avoid an immediate repeat (ここ is fine, but ここ from a 2-character pool gets tedious).
        const candidates = pool.filter((c) => c !== chars[chars.length - 1])
        chars.push(weightedPick(candidates.length ? candidates : pool, weights))
      }
      const format = formatFor(progress, chars)
      items.push({
        chars,
        target: chars.join(''),
        format,
        options: format === 'pick' ? buildSequenceOptions(chars, pool) : [],
      })
      continue
    }

    // Spread singles over the pool before repeating any.
    const remaining = pool.filter((c) => !usedSingles.has(c))
    const char = weightedPick(remaining.length ? remaining : pool, weights)
    if (remaining.length) usedSingles.add(char)
    else if (usedSingles.size >= pool.length) usedSingles.clear()

    const format = formatFor(progress, [char])
    items.push({
      chars: [char],
      target: char,
      format,
      options: format === 'pick' ? buildOptions(char, pool) : [],
    })
  }

  return items
}

/** A single random traced character — used to seed a quick practice from the chart. */
export function randomTraced(progress: Progress): string | null {
  const pool = tracedChars(progress)
  return pool.length ? pick(pool) : null
}
