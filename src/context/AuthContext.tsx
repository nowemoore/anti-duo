import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

interface AuthApi {
  /** False until the Supabase keys are filled in — the whole app still works offline. */
  configured: boolean
  /** True until the initial session lookup resolves. */
  loading: boolean
  session: Session | null
  email: string | null
  /** Email a 6-digit login code (creates the account on first use). */
  sendCode: (email: string) => Promise<void>
  /** Verify the emailed code and start a session. */
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthCtx = createContext<AuthApi | null>(null)

/**
 * Optional cloud account, by emailed one-time code. Everything below it works signed out — this only
 * decides whether progress is also backed up.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let unsubscribe: (() => void) | undefined
    let cancelled = false
    void getSupabase().then(async (supabase) => {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      setLoading(false)
      // Fires on sign-in, sign-out and token refresh — including from another tab, which shares the
      // same localStorage session.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
      unsubscribe = () => sub.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const sendCode = async (email: string) => {
    const supabase = await getSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) throw new Error(error.message)
  }

  const verifyCode = async (email: string, code: string) => {
    const supabase = await getSupabase()
    const e = email.trim()
    const token = code.trim()
    // An existing user's login code verifies as type 'email'; a brand-new user's first code is type
    // 'signup'. Try 'email' first and fall back to 'signup' so both the very first sign-in and every
    // later one work, regardless of which email Supabase sent.
    const first = await supabase.auth.verifyOtp({ email: e, token, type: 'email' })
    if (!first.error) return
    const second = await supabase.auth.verifyOtp({ email: e, token, type: 'signup' })
    if (second.error) throw new Error(second.error.message)
  }

  const signOut = async () => {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  }

  return (
    <AuthCtx.Provider
      value={{
        configured: isSupabaseConfigured,
        loading,
        session,
        email: session?.user?.email ?? null,
        sendCode,
        verifyCode,
        signOut,
      }}
    >
      {children}
    </AuthCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthApi {
  const value = useContext(AuthCtx)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
