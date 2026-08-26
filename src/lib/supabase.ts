import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

/** True once the VITE_SUPABASE_* env vars are provided (.env.local or CI secrets). */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

/**
 * The Supabase client, loaded on demand and shared by every caller afterwards.
 *
 * Deliberately a promise rather than a module-level client: the library is ~230 KB, and cloud backup
 * is optional. Behind a dynamic import it becomes its own chunk, fetched the first time an account
 * is actually in play — never on a build with no keys, and never for someone who stays signed out
 * (bar the one session lookup that finds nothing).
 *
 * `isSupabaseConfigured` deliberately lives here and not in that chunk, so asking whether accounts
 * exist at all costs nothing.
 */
let pending: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> {
  pending ??= import('./supabaseClient').then((m) => m.createSupabase())
  return pending
}
