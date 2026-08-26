import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

/**
 * Builds the browser client. In its own module so it can be dynamically imported: supabase-js is
 * ~230 KB, and an account is optional — a learner who never signs in should never pay for it.
 *
 * Only ever called behind `isSupabaseConfigured`, so the values are real by the time we get here.
 */
export function createSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // The browser's own localStorage, so a session survives a reload and a closed tab.
      persistSession: true,
      autoRefreshToken: true,
      // Login is an emailed 6-digit code, not a magic-link redirect, so there's never a session in
      // the URL to detect — and leaving this on makes every page load parse the hash for one.
      detectSessionInUrl: false,
    },
  })
}
