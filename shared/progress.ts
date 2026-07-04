// Shared progress normalization — used by the server (file storage) and the static demo
// (localStorage) so both coerce saved progress into the same valid shape.
import { defaultProgress } from './constants'
import type { Progress, TaskStats } from './types'

/** Keep only well-formed {attempts, points} entries; drops junk and missing/legacy keys. */
function normalizeStats(raw: unknown): Record<string, TaskStats> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, TaskStats> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<TaskStats> | null
    if (v && typeof v.attempts === 'number' && v.attempts >= 0 && typeof v.points === 'number') {
      out[key] = { attempts: v.attempts, points: v.points }
    }
  }
  return out
}

/** Keep only well-formed {taskType: weight} entries (finite, ≥ 0); drops junk and legacy keys. */
function normalizeTaskWeights(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = value
  }
  return out
}

/** Fill defaults and coerce settings into valid shapes (drops any legacy fields). */
export function normalizeProgress(p: Partial<Progress> | null | undefined): Progress {
  const base = defaultProgress()
  const s = p?.settings
  const settings = {
    name: typeof s?.name === 'string' ? s.name : base.settings.name,
    disabledCategories: Array.isArray(s?.disabledCategories) ? s.disabledCategories : [],
    disabledKanji: Array.isArray(s?.disabledKanji) ? s.disabledKanji : [],
    taskWeights: normalizeTaskWeights(s?.taskWeights),
  }
  return {
    settings,
    kanji: p?.kanji ?? {},
    stats: normalizeStats(p?.stats),
    lastRunAt: p?.lastRunAt,
  }
}
