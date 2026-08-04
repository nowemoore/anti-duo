// Shared progress normalization — used by the server (file storage) and the static demo
// (localStorage) so both coerce saved progress into the same valid shape.
import { GRAMMAR_ATTEMPT_HISTORY, defaultProgress } from './constants'
import type {
  GrammarAttempt,
  GrammarItemResult,
  GrammarReflection,
  GrammarTopicProgress,
  Progress,
  Settings,
  TaskStats,
} from './types'

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

/** Keep only well-formed per-item results; drops anything we couldn't attribute to an item. */
function normalizeItemResults(raw: unknown): GrammarItemResult[] {
  if (!Array.isArray(raw)) return []
  const out: GrammarItemResult[] = []
  for (const entry of raw) {
    const r = entry as Partial<GrammarItemResult> | null
    if (r && typeof r.itemId === 'string' && typeof r.correct === 'boolean') {
      out.push({ itemId: r.itemId, correct: r.correct, picked: typeof r.picked === 'string' ? r.picked : '' })
    }
  }
  return out
}

/** Keep well-formed attempts, newest-last, capped to the retention limit. */
function normalizeAttempts(raw: unknown): GrammarAttempt[] {
  if (!Array.isArray(raw)) return []
  const out: GrammarAttempt[] = []
  for (const entry of raw) {
    const a = entry as Partial<GrammarAttempt> | null
    if (!a || typeof a.at !== 'string') continue
    const items = normalizeItemResults(a.items)
    // An attempt with no recoverable items carries no signal — drop it rather than skew accuracy.
    if (items.length) out.push({ at: a.at, items })
  }
  return out.slice(-GRAMMAR_ATTEMPT_HISTORY)
}

/** Keep well-formed reflection answers; `feedback` is normalized to null until one is generated. */
function normalizeReflections(raw: unknown): Record<string, GrammarReflection> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, GrammarReflection> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const r = value as Partial<GrammarReflection> | null
    if (!r || typeof r.answer !== 'string') continue
    out[id] = {
      answer: r.answer,
      feedback: typeof r.feedback === 'string' ? r.feedback : null,
      ...(typeof r.updatedAt === 'string' ? { updatedAt: r.updatedAt } : {}),
    }
  }
  return out
}

/** Coerce the per-topic grammar state. Unknown topic ids are preserved — a topic the running build
 *  doesn't know about (older client, removed topic) keeps its data rather than losing it on save. */
function normalizeGrammar(raw: unknown): Record<string, GrammarTopicProgress> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const out: Record<string, GrammarTopicProgress> = {}
  for (const [topicId, value] of Object.entries(raw as Record<string, unknown>)) {
    const t = (value ?? {}) as Partial<GrammarTopicProgress>
    out[topicId] = {
      attempts: normalizeAttempts(t.attempts),
      reflections: normalizeReflections(t.reflections),
      ...(typeof t.vocabDoneAt === 'string' ? { vocabDoneAt: t.vocabDoneAt } : {}),
      ...(typeof t.passedAt === 'string' ? { passedAt: t.passedAt } : {}),
      ...(typeof t.unitsCreditedAt === 'string' ? { unitsCreditedAt: t.unitsCreditedAt } : {}),
    }
  }
  return Object.keys(out).length ? out : undefined
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
  const grammar = normalizeGrammar(p?.grammar)
  return {
    settings,
    units: legacy.units ?? legacy.kanji ?? {},
    stats: normalizeStats(p?.stats),
    lastRunAt: p?.lastRunAt,
    // Omitted entirely when empty, so untouched profiles keep the exact shape they had before.
    ...(grammar ? { grammar } : {}),
  }
}
