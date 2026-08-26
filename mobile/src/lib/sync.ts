// Cloud sync for progress, bound to the mobile Supabase client.
//
// The queries themselves live in @lib/sync, shared with the web app so the two clients can't drift
// on the table shape or the last-write-wins rule; this file only supplies the client.
import type { Progress } from '@shared/types'
import { pullRemote as pull, pushRemote as push, type RemoteProgress } from '@lib/sync'
import { supabase } from './supabase'

export type { RemoteProgress }

/** Read this user's row, or null if they have none yet (or the read failed). */
export function pullRemote(userId: string): Promise<RemoteProgress | null> {
  return pull(supabase, userId)
}

/** Upsert this user's progress with the given revision. Throws on network/RLS failure. */
export function pushRemote(userId: string, progress: Progress, rev: number): Promise<void> {
  return push(supabase, userId, progress, rev)
}
