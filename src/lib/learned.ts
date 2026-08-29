import type { Progress, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'
import type { LangEngine } from './lang/types'
import { introducedUnits, isKnownLevel } from './study'

/**
 * True once the unit (identified by its written form) counts as known — see {@link isKnownLevel}.
 * Shares that predicate deliberately: this drives whether a word renders in native script, so if it
 * disagreed with the practice/re-teach classification a lapsing kanji would flip language on screen
 * at a different moment than it flips state.
 */
export function isFormLearned(form: string, index: ContentIndex, progress: Progress): boolean {
  const k = index.byForm.get(form)
  if (!k) return false
  return isKnownLevel(progress.units[k.idx]?.lvl ?? 0)
}

/** Any CJK ideograph — the characters that map to curriculum units. Mirrors the loader's regex. */
const KANJI_CHAR = /[㐀-䶿一-鿿豈-﫿]/

/**
 * The idx values the learner has introduced, as a set for repeated membership tests. Built from
 * {@link introducedUnits} rather than raw levels so it inherits the enabled category/unit filtering —
 * a paused category shouldn't count as known.
 */
export function learnedUnitIdxs(index: ContentIndex, progress: Progress): Set<number> {
  return new Set(introducedUnits(index, progress).map((u) => u.idx))
}

/**
 * True when **every** kanji in `word` is a unit the learner has introduced. A kanji with no
 * curriculum unit at all (e.g. 合 in 間に合う) disqualifies the word, since we can't know it's known.
 *
 * Note this is `every`, whereas {@link contentTokenDisplay} below uses `some` — deliberately. They
 * answer different questions: that one asks "is native script safe to render", this one asks "does
 * the learner own this word well enough to be tested on it". Don't unify them.
 *
 * Pass `known` when checking many words in a row, to avoid rebuilding the set each time.
 */
export function isWordLearned(
  word: string,
  index: ContentIndex,
  progress: Progress,
  known?: Set<number>,
): boolean {
  const set = known ?? learnedUnitIdxs(index, progress)
  const chars = [...word].filter((c) => KANJI_CHAR.test(c))
  if (chars.length === 0) return false // kana-only: no unit to have learned
  return chars.every((c) => {
    const unit = index.byForm.get(c)
    return unit !== undefined && set.has(unit.idx)
  })
}

export type TokenDisplay = 'english' | 'native'

/**
 * A content word shows in native script (with whole-word reading) once **≥1** of its tracked units is
 * learned; otherwise it stays English. A word with no tracked units renders natively only when the
 * language deems an untracked surface safe to show (JA: kana-only, e.g. ある/です) — so a word built
 * on an unfamiliar unit (島, 田中) stays English and is never shown as if it were known.
 *
 * `isMetWord` narrows that last case where the caller can answer it: a kana word the learner has met
 * reads in kana, one they haven't reads in English, exactly as an unlearned kanji word does. Without
 * it every kana-only surface renders natively — which was right while nothing tracked kana words,
 * and wrong now that something does. Omit it and the old behaviour stands, so a caller with no
 * progress to hand (a preview, a test) still gets a sentence it can render.
 */
export function contentTokenDisplay(
  token: WordToken,
  isLearned: (form: string) => boolean,
  lang: LangEngine,
  isMetWord?: (surface: string) => boolean,
): TokenDisplay {
  if (token.units.length === 0) {
    if (!lang.nativeWhenUntracked(token.surface)) return 'english'
    // A surface the language would happily show, but which the course does track as vocabulary:
    // it has to be earned like any other word.
    return isMetWord ? (isMetWord(token.surface) ? 'native' : 'english') : 'native'
  }
  return token.units.some(isLearned) ? 'native' : 'english'
}
