// Supabase connection values, read from the environment so no keys are committed to the repo.
//
//   • Local dev / build:  put them in  mobile/.env   (gitignored — copy from .env.example)
//   • CI deploy:          GitHub Actions secrets, injected in .github/workflows/deploy.yml
//
// EXPO_PUBLIC_* variables are inlined into the app bundle at build time. Note the anon key is a
// *publishable* key: it necessarily ships inside any client build, so it isn't a true secret —
// keeping it out of git is just hygiene. Your data is protected by row-level security + disabled
// signups, not by hiding this key.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
