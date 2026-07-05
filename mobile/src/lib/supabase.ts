// Supabase client for React Native / Expo. Pure JS, so it runs in Expo Go with no custom build.
// Session is persisted in AsyncStorage (same store as progress) so you stay logged in across launches.
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig'

/** True once the EXPO_PUBLIC_SUPABASE_* env vars are provided (mobile/.env or CI secrets). */
export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

// Fall back to a syntactically-valid placeholder when unconfigured so createClient never throws;
// every call is gated behind isSupabaseConfigured, so the placeholder client is never used.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based OAuth redirect on mobile — we log in with an emailed code instead.
      detectSessionInUrl: false,
    },
  },
)
