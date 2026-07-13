// Shared progress normalization — used by the server (file storage) and the static demo
// (localStorage) so both coerce saved progress into the same valid shape.
import { defaultProgress } from './constants'
import type { Progress, Settings, TaskStats } from './types'

/** Renamed task-type keys (old → new), migrated on read so historical stats/weights aren't orphaned. */
const TASK_KEY_MIGRATIONS: Record<string, string> = { 'draw-kanji': 'draw' }
const migrateTaskKey = (key: string): string => TASK_KEY_MIGRATIONS[key] ?? key

/** Keep only well-formed {attempts, points} entries; drops junk and missing keys, migrates renamed ones. */
function normalizeStats(raw: unknown): Record<string, TaskStats> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, TaskStats> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = value as Partial<TaskStats> | null
    if (v && typeof v.attempts === 'number' && v.attempts >= 0 && typeof v.points === 'number') {
      out[migrateTaskKey(key)] = { attempts: v.attempts, points: v.points }
    }
  }
  return out
}

/** Keep only well-formed {taskType: weight} entries (finite, ≥ 0); drops junk and legacy keys. */
function normalizeTaskWeights(raw: unknown): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[migrateTaskKey(key)] = value
  }
  return out
}

/** Fill defaults and coerce settings into valid shapes. Migrates legacy `kanji`/`disabledKanji`
 *  keys (pre-generalization) to `units`/`disabledUnits` so existing progress isn't lost. */
export function normalizeProgress(p: Partial<Progress> | null | undefined): Progress {
  const base = defaultProgress()
  // Legacy shape (before the Kanji→Unit rename) for back-compat reads.
  const legacy = (p ?? {}) as { units?: Progress['units']; kanji?: Progress['units'] }
  const s = (p?.settings ?? {}) as Partial<Settings> & { disabledKanji?: number[] }
  const settings: Settings = {
    name: typeof s.name === 'string' ? s.name : base.settings.name,
    disabledCategories: Array.isArray(s.disabledCategories) ? s.disabledCategories : [],
    disabledUnits: Array.isArray(s.disabledUnits)
      ? s.disabledUnits
      : Array.isArray(s.disabledKanji)
        ? s.disabledKanji
        : [],
    taskWeights: normalizeTaskWeights(s.taskWeights),
  }
  return {
    settings,
    units: legacy.units ?? legacy.kanji ?? {},
    stats: normalizeStats(p?.stats),
    lastRunAt: p?.lastRunAt,
  }
}
