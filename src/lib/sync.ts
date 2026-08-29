// Cloud sync for progress. The local store stays the source of truth; the `progress` table in
// Supabase is a per-user backup that also lets a fresh device pull your data back.
//
// Conflict handling is last-write-wins by `rev` (a millisecond client timestamp bumped on every
// local change). On login we compare the remote rev with the local rev and keep the newer one.
// That's simple and safe for personal single-device use; it is NOT a field-level merge, so if you
// edited two devices while both were offline, the one that syncs last wins wholesale.
//
// The client is a parameter rather than an import: the two apps build theirs differently (the phone
// persists its session in AsyncStorage, the browser in localStorage), and this file is vendored into
// mobile/ by mobile/scripts/sync-shared.js — so it can't reach for either one.
import { normalizeProgress } from '../../shared/progress'
import type { Progress } from '../../shared/types'

const TABLE = 'progress'

/* eslint-disable @typescript-eslint/no-explicit-any -- the client's own types are its to own. */
/**
 * The slice of a Supabase client this module uses. See the note above on why it isn't the real one.
 *
 * `from` returns `any` deliberately. Spelling out the query builder structurally is possible but
 * makes the compiler compare it against supabase's own deeply-generic builder on every call, which
 * it gives up on ("type instantiation is excessively deep"). The two calls below are three lines
 * each and the shapes they read are asserted at the boundary, so the trade is worth it.
 */
export interface ProgressClient {
  from(table: string): any
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface RemoteProgress {
  data: Progress
  rev: number
}

/** Read this user's row, or null if they have none yet (or the read failed). */
export async function pullRemote(
  client: ProgressClient,
  userId: string,
): Promise<RemoteProgress | null> {
  const { data, error } = await client
    .from(TABLE)
    .select('data, rev')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return { data: normalizeProgress(data.data as Partial<Progress>), rev: Number(data.rev) || 0 }
}

/** Upsert this user's progress with the given revision. Throws on network/RLS failure. */
export async function pushRemote(
  client: ProgressClient,
  userId: string,
  progress: Progress,
  rev: number,
): Promise<void> {
  const { error } = await client.from(TABLE).upsert(
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
