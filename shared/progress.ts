// Shared progress normalization — used by the server (file storage) and the static demo
// (localStorage) so both coerce saved progress into the same valid shape.
import { defaultProgress } from './constants'
import type { Progress } from './types'

/** Fill defaults and coerce settings into valid shapes (drops any legacy fields). */
export function normalizeProgress(p: Partial<Progress> | null | undefined): Progress {
  const base = defaultProgress()
  const s = p?.settings
  const settings = {
    name: typeof s?.name === 'string' ? s.name : base.settings.name,
    disabledCategories: Array.isArray(s?.disabledCategories) ? s.disabledCategories : [],
    disabledKanji: Array.isArray(s?.disabledKanji) ? s.disabledKanji : [],
  }
  return {
    settings,
    kanji: p?.kanji ?? {},
    lastRunAt: p?.lastRunAt,
  }
}
