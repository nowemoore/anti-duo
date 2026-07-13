import { INTRODUCED_LEVEL } from '../../shared/constants'
import type { Progress, WordToken } from '../../shared/types'
import type { ContentIndex } from './content'
import type { LangEngine } from './lang/types'

/** True once the unit (identified by its written form) has been introduced (lvl ≥ INTRODUCED_LEVEL). */
export function isFormLearned(form: string, index: ContentIndex, progress: Progress): boolean {
  const k = index.byForm.get(form)
  if (!k) return false
  return (progress.units[k.idx]?.lvl ?? 0) >= INTRODUCED_LEVEL
}

export type TokenDisplay = 'english' | 'native'

/**
 * A content word shows in native script (with whole-word reading) once **≥1** of its tracked units is
 * learned; otherwise it stays English. A word with no tracked units renders natively only when the
 * language deems an untracked surface safe to show (JA: kana-only, e.g. ある/です) — so a word built
 * on an unfamiliar unit (島, 田中) stays English and is never shown as if it were known.
 */
export function contentTokenDisplay(
  token: WordToken,
  isLearned: (form: string) => boolean,
  lang: LangEngine,
): TokenDisplay {
  if (token.units.length === 0) return lang.nativeWhenUntracked(token.surface) ? 'native' : 'english'
  return token.units.some(isLearned) ? 'native' : 'english'
}
