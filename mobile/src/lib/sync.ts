// Cloud sync for progress. Local AsyncStorage stays the source of truth; the `progress` table in
// Supabase is a per-user backup that also lets a fresh install pull your data back.
//
// Conflict handling is last-write-wins by `rev` (a millisecond client timestamp bumped on every
// local change). On login we compare the remote rev with the local rev and keep the newer one.
// That's simple and safe for personal single-device use; it is NOT a field-level CRDT merge, so if
// you edited two devices while both were offline, the one that syncs last wins wholesale.
import { normalizeProgress } from '@shared/progress'
import type { Progress } from '@shared/types'
import { supabase } from './supabase'

const TABLE = 'progress'

export interface RemoteProgress {
  data: Progress
  rev: number
}

/** Read this user's row, or null if they have none yet (or the read failed). */
export async function pullRemote(userId: string): Promise<RemoteProgress | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, rev')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return { data: normalizeProgress(data.data as Partial<Progress>), rev: Number(data.rev) || 0 }
}

/** Upsert this user's progress with the given revision. Throws on network/RLS failure. */
export async function pushRemote(userId: string, progress: Progress, rev: number): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: userId,
      data: normalizeProgress(progress),
      rev,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(error.message)
}
