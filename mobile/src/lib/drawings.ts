// Saves finger-drawn "draw the word" answers to Supabase (the `drawings` table), as a history — one
// row per drawing. Two orthogonal facts are stored: what the on-device recognizer *assessed*, and the
// learner's *override* if they disputed it (null = undisputed). Mirrors sync.ts; everything no-ops when
// Supabase isn't configured, and callers fire-and-forget (a failure here must never disrupt practice).
// The `drawings` table + RLS are created in the Supabase dashboard.
import { supabase, isSupabaseConfigured } from './supabase'

const TABLE = 'drawings'

export interface DrawingRow {
  userId: string
  lang: string
  unitIdx: number
  word: string
  /** Stroke paths as drawn: [[{x,y}, …], …]. Stored as jsonb. */
  strokes: unknown
  /** The on-device recognizer's verdict at lock-in. */
  correct: boolean
}

export interface SavedDrawing {
  id: string
  word: string | null
  strokes: unknown
  /** What the recognizer judged. */
  assessed_correct: boolean
  /** The learner's verdict if they disputed it; null = undisputed. */
  override_correct: boolean | null
  created_at: string
}

/** The learner's final answer for a saved drawing (their override if any, else the recognizer's call). */
export const finalCorrect = (d: Pick<SavedDrawing, 'assessed_correct' | 'override_correct'>): boolean =>
  d.override_correct ?? d.assessed_correct

/** Append a drawing with the recognizer's verdict; returns the new row's id (for a later override). */
export async function saveDrawing(row: DrawingRow): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: row.userId,
      lang: row.lang,
      unit_idx: row.unitIdx,
      word: row.word,
      strokes: row.strokes,
      assessed_correct: row.correct,
      // override_correct left null — set only if the learner disputes it.
    })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as string
}

/**
 * The learner disputed the recognizer — record their (opposite) verdict in `override_correct`. The two
 * override buttons only ever flip the call, so their verdict is `!recognizerCorrect`.
 */
export async function overrideDrawing(id: string, recognizerCorrect: boolean): Promise<void> {
  if (!isSupabaseConfigured) return
  await supabase.from(TABLE).update({ override_correct: !recognizerCorrect }).eq('id', id)
}

/** This user's drawings (newest first), optionally for one unit — for a future gallery view. */
export async function listDrawings(userId: string, lang: string, unitIdx?: number): Promise<SavedDrawing[]> {
  if (!isSupabaseConfigured) return []
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
