import type { LangEngine } from './types'
import { CHOICE_DISTRACTORS, bySimilarity, toOptionSet } from './reading'
import { shuffle } from '../random'

// Combining marks ignored when comparing skeletons (harakat + tatweel + superscript alef).
const MARKS = /[ـً-ٰٕ]/g
const stripHarakat = (s: string) => s.replace(MARKS, '')

// The three short vowels — the crux of Arabic vocalisation and what learners most confuse.
const FATHA = 'َ'
const DAMMA = 'ُ'
const KASRA = 'ِ'
const SHORT_VOWELS = [FATHA, DAMMA, KASRA]

/**
 * Tier 1 — re-vowelings: the same consonant skeleton with one short vowel changed (كَتَبَ → كُتَبَ). These
 * are minimal pairs that test the vocalisation directly. Distinct variants, excluding the correct form.
 */
function revowelings(correct: string): string[] {
  const chars = [...correct]
  const out = new Set<string>()
  chars.forEach((c, i) => {
    if (!SHORT_VOWELS.includes(c)) return
    for (const v of SHORT_VOWELS) {
      if (v === c) continue
      const next = [...chars]
      next[i] = v
      out.add(next.join(''))
    }
  })
  out.delete(correct)
  return [...out]
}

// Tier 3 — consonants Arabic learners confuse (emphatics, sibilants, the h- and q/k families…).
const CONFUSABLE_GROUPS = [
  ['ت', 'ط'], // t / emphatic ṭ
  ['د', 'ض'], // d / emphatic ḍ
  ['س', 'ص'], // s / emphatic ṣ
  ['ذ', 'ظ', 'ز'], // dh / emphatic ẓ / z
  ['ح', 'ه', 'خ'], // ḥ / h / kh
  ['ق', 'ك'], // q / k
  ['س', 'ش'], // s / sh
  ['ع', 'غ'], // ʿayn / ghayn
  ['ث', 'س'], // th / s
  ['ج', 'خ'], // j / kh
]
const CONFUSABLE = new Map<string, string[]>()
for (const group of CONFUSABLE_GROUPS) {
  for (const letter of group) {
    const alts = CONFUSABLE.get(letter) ?? []
    for (const other of group) if (other !== letter && !alts.includes(other)) alts.push(other)
    CONFUSABLE.set(letter, alts)
  }
}

/**
 * Tier 3 — near-consonant swaps: replace one letter with a phonetically confusable one, keeping the
 * vocalisation (كَتَبَ → كَطَبَ). Near-minimal pairs that sound almost the same.
 */
function consonantSwaps(correct: string): string[] {
  const chars = [...correct]
  const out = new Set<string>()
  chars.forEach((c, i) => {
    const alts = CONFUSABLE.get(c)
    if (!alts) return
    for (const a of alts) {
      const next = [...chars]
      next[i] = a
      out.add(next.join(''))
    }
  })
  out.delete(correct)
  return [...out]
}

/**
 * Arabic engine logic. Untracked words always render in Arabic script. The "pick the reading" options
 * are built to be genuinely confusable: mostly the same word re-voweled differently (minimal vowel
 * pairs) plus a near-consonant swap, so the learner is tested on the exact vocalisation — with plain
 * pool similarity only as a fallback when a word can't be varied.
 */
export const arEngine: LangEngine = {
  id: 'ar',
  readingOptions(correct, _surface, pool) {
    const skeleton = stripHarakat(correct)
    // Real words that share the exact skeleton but are voweled differently — the ideal minimal pairs.
    const realMinimalPairs = shuffle(pool.filter((p) => p !== correct && stripHarakat(p) === skeleton))
    const revoweled = shuffle(revowelings(correct))
    const swapped = shuffle(consonantSwaps(correct))
    const similar = bySimilarity(correct, pool)

    const chosen: string[] = []
    const used = new Set<string>([correct])
    const take = (from: string[], count: number) => {
      for (const s of from) {
        if (chosen.length >= CHOICE_DISTRACTORS || count <= 0) break
        if (used.has(s)) continue
        used.add(s)
        chosen.push(s)
        count--
      }
    }

    // A confusable mix: real minimal pairs first, else two vowel-variants + one consonant-variant, then
    // top up from either, and finally plain pool similarity if the word can't be varied enough.
    take(realMinimalPairs, CHOICE_DISTRACTORS)
    take(revoweled, 2)
    take(swapped, 1)
    take(revoweled, CHOICE_DISTRACTORS)
    take(swapped, CHOICE_DISTRACTORS)
    take(similar, CHOICE_DISTRACTORS)

    return toOptionSet(correct, chosen.slice(0, CHOICE_DISTRACTORS))
  },
  nativeWhenUntracked() {
    // Arabic is a single script — an untracked word is still shown in Arabic, never romanised.
    return true
  },
}
