import { INTRODUCED_LEVEL } from '../../shared/constants'
import type { Progress, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'

/** True once the kanji has been introduced (lvl ≥ INTRODUCED_LEVEL). */
export function isCharLearned(char: string, index: ContentIndex, progress: Progress): boolean {
  const k = index.byChar.get(char)
  if (!k) return false
  return (progress.kanji[k.idx]?.lvl ?? 0) >= INTRODUCED_LEVEL
}

export type TokenDisplay = 'english' | 'japanese'

/** Any CJK ideograph (kanji) — excludes kana. */
const KANJI_RE = /[㐀-䶿一-鿿豈-﫿]/

/**
 * A content word shows as Japanese (with whole-word furigana) once **≥1** of its tracked kanji is
 * learned; otherwise it stays English. A word with no tracked kanji is Japanese only if it's
 * kana-only (ある, です); if it contains kanji outside the study set (島, 田中), it stays English so
 * the learner is never shown an unfamiliar kanji as if it were known.
 */
export function contentTokenDisplay(
  token: WordToken,
  isLearned: (char: string) => boolean,
): TokenDisplay {
  if (token.kanji.length === 0) return KANJI_RE.test(token.ja) ? 'english' : 'japanese'
  return token.kanji.some(isLearned) ? 'japanese' : 'english'
}
