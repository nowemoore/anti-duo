// Shared progress normalization — used by the server (file storage) and the static demo
// (localStorage) so both coerce saved progress into the same valid shape.
import {
  GRAMMAR_ATTEMPT_HISTORY,
  KANA_STREAK_MAX,
  WORD_STREAK_MAX,
  defaultProgress,
} from './constants'
import type {
  GrammarAttempt,
  GrammarItemResult,
  GrammarReflection,
  GrammarTopicProgress,
  KanaProgress,
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

/**
 * Per-word correct-run counters. Values are clamped to [0, WORD_STREAK_MAX] and rounded, so a
 * corrupted or out-of-range entry can't make a word permanently "known". Empty keys are dropped.
 */
function normalizeWords(raw: unknown): Record<string, number> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const out: Record<string, number> = {}
  for (const [word, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!word || typeof value !== 'number' || !Number.isFinite(value)) continue
    const streak = Math.min(WORD_STREAK_MAX, Math.max(0, Math.round(value)))
    // A zeroed streak carries no information — drop it rather than grow the blob forever.
    if (streak > 0) out[word] = streak
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Coerce the kana course state. Character runs are clamped to [0, KANA_STREAK_MAX] exactly as word
 * runs are, so a corrupted entry can't make a character permanently "known".
 *
 * Traced entries are kept even when the character isn't one this build knows about: the table could
 * gain or lose characters, and an older client must not wipe what a newer one recorded.
 */
function normalizeKana(raw: unknown): KanaProgress | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const src = raw as Partial<KanaProgress>

  const chars: Record<string, number> = {}
  if (typeof src.chars === 'object' && src.chars !== null) {
    for (const [char, value] of Object.entries(src.chars as Record<string, unknown>)) {
      if (!char || typeof value !== 'number' || !Number.isFinite(value)) continue
      const streak = Math.min(KANA_STREAK_MAX, Math.max(0, Math.round(value)))
      // A zeroed run carries no information — drop it rather than grow the blob forever.
      if (streak > 0) chars[char] = streak
    }
  }

  const traced: Record<string, string> = {}
  if (typeof src.traced === 'object' && src.traced !== null) {
    for (const [char, value] of Object.entries(src.traced as Record<string, unknown>)) {
      if (char && typeof value === 'string') traced[char] = value
    }
  }

  return Object.keys(chars).length || Object.keys(traced).length ? { chars, traced } : undefined
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
  const words = normalizeWords(p?.words)
  const kana = normalizeKana(p?.kana)
  return {
    settings,
    units: legacy.units ?? legacy.kanji ?? {},
    stats: normalizeStats(p?.stats),
    lastRunAt: p?.lastRunAt,
    // Omitted entirely when empty, so untouched profiles keep the exact shape they had before.
    ...(words ? { words } : {}),
    ...(grammar ? { grammar } : {}),
    ...(kana ? { kana } : {}),
  }
}
