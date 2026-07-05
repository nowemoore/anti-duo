import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))

    // Supabase refreshes tokens on a timer that must be paused while the app is backgrounded.
    supabase.auth.startAutoRefresh()
    const appSub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        supabase.auth.startAutoRefresh()
      } else if (next.match(/inactive|background/)) {
        supabase.auth.stopAutoRefresh()
      }
      appState.current = next
    })
    return () => {
      sub.subscription.unsubscribe()
      appSub.remove()
    }
  }, [])

  const sendCode = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) throw new Error(error.message)
  }

  const verifyCode = async (email: string, code: string) => {
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

export function useAuth(): AuthApi {
  const value = useContext(AuthCtx)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
