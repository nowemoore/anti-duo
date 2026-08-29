// Appends one row per answered practice question to Supabase (the `answers` table). Mirrors
// drawings.ts: everything no-ops when Supabase isn't configured, and callers fire-and-forget, since
// a logging failure must never disrupt practice.
//
// `Progress` keeps only running totals — a level per unit, a tally per task type — which cannot
// answer "which distractor did they pick", "do they read this kanji but fail to write it", or
// "what fraction is still correct after three weeks". Those need the individual events, so they
// live here rather than in the progress blob, which round-trips through normalizeProgress on every
// save.
//
// The migration lives in supabase/answers.sql.
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'answers'

export interface AnswerRow {
  userId: string
  lang: string
  /** The kanji/unit the question was about. Null for a kana word, which has no unit. */
  unitIdx: number | null
  /** TaskType, e.g. 'cloze' — kept as a string so a new task type needs no migration. */
  taskKind: string
  /** Whether it counted as correct (for which-words, whether it was a perfect score). */
  correct: boolean
  /** Raw task score, which is graded rather than binary for some task types. */
  score: number
  /**
   * What the learner actually answered, as displayed. The point of the whole table: a distractor
   * nobody ever picks and one everybody picks are indistinguishable in a running tally, so there is
   * currently no feedback loop on the authored `distractors` columns.
   */
  picked: string | null
  /** The sentence the question was built from, when it came from one. */
  sentenceId: string | null
  /** The unit's level *before* this answer — retention depends on prior strength. Null for kana. */
  lvlBefore: number | null
  /** The word's streak before this answer, when the task tested one specific curated word. */
  wordStreakBefore: number | null
  /** When this unit was last answered, so the review gap is on the row rather than a window query. */
  prevSeenAt: string | null
  /** Time from the question appearing to lock-in. Separates recall from working it out. */
  latencyMs: number | null
  /** True when the target came from the uniform exploration slice; see EXPLORE_RATE. */
  randomPick: boolean
  /** Links to the `drawings` row holding the strokes, for draw tasks. */
  drawingId?: string | null
}

/**
 * A task's answer is deliberately opaque to the session (its shape belongs to the task's module), so
 * render only the shapes that are meaningfully text: a picked option, a typed reading, a multi-select.
 * Anything else — notably a draw answer's stroke arrays — logs as null rather than dumping a blob
 * into a text column; those strokes are reachable through `drawing_id` instead.
 */
export function describeAnswer(answer: unknown): string | null {
  if (typeof answer === 'string') return answer || null
  if (typeof answer === 'number' || typeof answer === 'boolean') return String(answer)
  if (Array.isArray(answer) && answer.every((a) => typeof a === 'string')) {
    return answer.length ? (answer as string[]).join(' | ') : null
  }
  return null
}

/** Append one answered question. Never throws; returns false if it wasn't written. */
export async function saveAnswer(row: AnswerRow): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { error } = await supabase.from(TABLE).insert({
    user_id: row.userId,
    lang: row.lang,
    unit_idx: row.unitIdx,
    task_kind: row.taskKind,
    correct: row.correct,
    score: row.score,
    picked: row.picked,
    sentence_id: row.sentenceId,
    lvl_before: row.lvlBefore,
    word_streak_before: row.wordStreakBefore,
    prev_seen_at: row.prevSeenAt,
    latency_ms: row.latencyMs,
    random_pick: row.randomPick,
    drawing_id: row.drawingId ?? null,
  })
  return !error
}
