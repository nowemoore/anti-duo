/// <reference types="expo/types" />

// Types for our EXPO_PUBLIC_* environment variables (inlined at build time by Expo).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string
  }
}
