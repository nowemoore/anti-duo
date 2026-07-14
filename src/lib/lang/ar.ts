import type { LangEngine } from './types'
import { CHOICE_DISTRACTORS, bySimilarity, toOptionSet } from './reading'

/**
 * Arabic engine logic. Arabic has no okurigana-style trailing inflection to protect and no
 * kana/kanji script split, so the reading distractors fall back to the generic similarity ranking
 * (confusable voweled forms), and untracked words always render in Arabic script.
 */
export const arEngine: LangEngine = {
  id: 'ar',
  readingOptions(correct, _surface, pool) {
    // "reading" here is the voweled form; pick the most confusable voweled distractors from the pool.
    return toOptionSet(correct, bySimilarity(correct, pool).slice(0, CHOICE_DISTRACTORS))
  },
  nativeWhenUntracked() {
    // Arabic is a single script — an untracked word is still shown in Arabic, never romanised.
    return true
  },
}
