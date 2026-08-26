/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in the no-backend static build (npm run build:static); undefined otherwise. */
  readonly VITE_STATIC?: string
  /** Supabase project URL. Absent = cloud backup is simply off; the app works offline. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon/publishable key. Ships in the bundle by design — see src/lib/supabaseConfig.ts. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
