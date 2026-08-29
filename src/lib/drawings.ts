// Saves finger-drawn "draw the word" answers to Supabase (the `drawings` table), as a history — one
// row per drawing. Two orthogonal facts are stored: what the on-device recognizer *assessed*, and the
// learner's *override* if they disputed it (null = undisputed). Mirrors sync.ts; everything no-ops when
// Supabase isn't configured, and callers fire-and-forget (a failure here must never disrupt practice).
// The `drawings` table + RLS are created in the Supabase dashboard.
//
// The web's Supabase client is loaded on demand (a ~230 KB chunk nobody signed out should pay for),
// so each call awaits `getSupabase()` where the phone's copy reads a module-level client. Everything
// else is the phone's file verbatim — the two write the same columns, or the table means two things.
import { getSupabase, isSupabaseConfigured } from './supabase'

const TABLE = 'drawings'

/**
 * How the attempt was produced.
 *   'recognized' — the learner wrote it from the reading and the recognizer graded it.
 *   'traced'     — no reference pattern for these characters, so the word was shown faintly and
 *                  traced over. Ungraded, and the strokes follow a guide rather than recall, which
 *                  matters if they're used as training data.
 *   'self'       — kana practice: written from memory with no guide and no recognizer, then marked
 *                  by the learner. Free recall like 'recognized', but the verdict is a human's, so
 *                  it lands in `override_correct` with `assessed_correct` left null.
 */
export type DrawingMode = 'recognized' | 'traced' | 'self'

export interface DrawingRow {
  userId: string
  lang: string
  unitIdx: number
  word: string
  /** Stroke paths as drawn: [[{x,y}, …], …]. Stored as jsonb. */
  strokes: unknown
  /** The on-device recognizer's verdict at lock-in; null when there was nothing to grade against. */
  correct: boolean | null
  /**
   * The learner's own verdict, for modes nothing can grade ('self'). Written straight to
   * `override_correct`, which is where a human's call belongs whether or not it overrode a machine.
   */
  selfMarked?: boolean
  mode: DrawingMode
}

export interface SavedDrawing {
  id: string
  word: string | null
  strokes: unknown
  /** What the recognizer judged; null for a traced attempt, which nothing graded. */
  assessed_correct: boolean | null
  /** The learner's verdict if they disputed it; null = undisputed. */
  override_correct: boolean | null
  created_at: string
}

/** The learner's final answer for a saved drawing (their override if any, else the recognizer's call). */
/** Null when nothing graded it and the learner didn't say either — i.e. a traced attempt. */
export const finalCorrect = (
  d: Pick<SavedDrawing, 'assessed_correct' | 'override_correct'>,
): boolean | null => d.override_correct ?? d.assessed_correct

/**
 * Append a drawing with the recognizer's verdict; returns the new row's id (for a later override).
 *
 * `mode` is a newer column. If the table hasn't been given it yet the insert is retried without it,
 * so an un-migrated database keeps collecting graded attempts instead of silently dropping every
 * drawing. Traced rows are skipped in that case rather than being written as if they were graded —
 * an ungraded attempt recorded as a wrong answer would poison the training data.
 */
export async function saveDrawing(row: DrawingRow): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const supabase = await getSupabase()
  const base = {
    user_id: row.userId,
    lang: row.lang,
    unit_idx: row.unitIdx,
    word: row.word,
    strokes: row.strokes,
    assessed_correct: row.correct,
    // Null unless the learner marked it themselves; otherwise set later, if they dispute the machine.
    override_correct: row.selfMarked ?? null,
  }

  const { data, error } = await supabase.from(TABLE).insert({ ...base, mode: row.mode }).select('id').single()
  if (!error && data) return data.id as string

  // PGRST204 = column not found in the schema cache, i.e. `mode` hasn't been added yet.
  const missingColumn = error?.code === 'PGRST204' || /mode/i.test(error?.message ?? '')
  // A traced row is dropped rather than written unlabelled — an ungraded, guide-following attempt
  // recorded as if it were free recall would poison the training data. A 'self' row is safe to keep:
  // its assessed_correct is null and its verdict sits in override_correct, so nothing is claimed
  // about the recognizer either way.
  if (!missingColumn || row.mode === 'traced') return null

  const retry = await supabase.from(TABLE).insert(base).select('id').single()
  return retry.error || !retry.data ? null : (retry.data.id as string)
}

/**
 * The learner disputed the recognizer — record their (opposite) verdict in `override_correct`. The two
 * override buttons only ever flip the call, so their verdict is `!recognizerCorrect`.
 */
export async function overrideDrawing(id: string, recognizerCorrect: boolean): Promise<void> {
  if (!isSupabaseConfigured) return
  const supabase = await getSupabase()
  await supabase.from(TABLE).update({ override_correct: !recognizerCorrect }).eq('id', id)
}

/** This user's drawings (newest first), optionally for one unit — for a future gallery view. */
export async function listDrawings(userId: string, lang: string, unitIdx?: number): Promise<SavedDrawing[]> {
  if (!isSupabaseConfigured) return []
  const supabase = await getSupabase()
  let query = supabase
    .from(TABLE)
    .select('id, word, strokes, assessed_correct, override_correct, created_at')
    .eq('user_id', userId)
    .eq('lang', lang)
  if (unitIdx != null) query = query.eq('unit_idx', unitIdx)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error || !data) return []
  return data as SavedDrawing[]
}
