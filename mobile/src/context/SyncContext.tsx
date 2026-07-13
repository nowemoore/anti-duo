import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { useProgress } from './ProgressContext'
import { useLanguage } from './LanguageContext'
import { getLocalRev, setLocalRev } from '../lib/storage'
import { pullRemote, pushRemote } from '../lib/sync'

type SyncState = 'idle' | 'syncing' | 'synced' | 'error'

interface SyncApi {
  state: SyncState
  /** ms timestamp of the last successful sync, or null. */
  lastSyncedAt: number | null
  error: string | null
}

const SyncCtx = createContext<SyncApi>({ state: 'idle', lastSyncedAt: null, error: null })

const PUSH_DEBOUNCE_MS = 1500

/**
 * Keeps local progress and the Supabase backup in step. Sits inside AuthProvider + ProgressProvider.
 * On login it reconciles (newer of local/remote wins by rev); afterwards each local change is pushed
 * on a short debounce. De-dupes by content snapshot so adopting the remote doesn't echo back.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { progress, update } = useProgress()
  const lang = useLanguage().id

  const [state, setState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ready = useRef(false) // initial reconcile for the current session is done
  const snapshot = useRef('') // JSON of the last progress we synced, to avoid echo pushes
  const progressRef = useRef(progress)
  progressRef.current = progress
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = session?.user?.id ?? null

  // Reconcile whenever we gain (or switch) a signed-in user.
  useEffect(() => {
    ready.current = false
    if (!userId) {
      setState('idle')
      return
    }
    let cancelled = false
    setState('syncing')
    setError(null)
    ;(async () => {
      try {
        const localRev = await getLocalRev(lang)
        const remote = await pullRemote(userId)
        if (cancelled) return
        if (remote && remote.rev > localRev) {
          // Cloud is newer (another device, or a fresh install) → adopt it.
          snapshot.current = JSON.stringify(remote.data)
          update(() => remote.data)
          await setLocalRev(lang, remote.rev)
        } else {
          // Local is newer or the cloud has nothing yet → upload local.
          const local = progressRef.current
          const rev = localRev || Date.now()
          snapshot.current = JSON.stringify(local)
          await setLocalRev(lang, rev)
          await pushRemote(userId, local, rev)
        }
        if (cancelled) return
        ready.current = true
        setLastSyncedAt(Date.now())
        setState('synced')
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Sync failed')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, update])

  // Push local edits (debounced) once the initial reconcile has happened.
  useEffect(() => {
    if (!userId || !ready.current) return
    const snap = JSON.stringify(progress)
    if (snap === snapshot.current) return // nothing new (or this is the just-synced value)
    if (pushTimer.current) clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(async () => {
      try {
        setState('syncing')
        const rev = Date.now()
        await setLocalRev(lang, rev)
        await pushRemote(userId, progressRef.current, rev)
        snapshot.current = JSON.stringify(progressRef.current)
        setLastSyncedAt(Date.now())
        setState('synced')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sync failed')
        setState('error')
      }
    }, PUSH_DEBOUNCE_MS)
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current)
    }
  }, [progress, userId])

  return <SyncCtx.Provider value={{ state, lastSyncedAt, error }}>{children}</SyncCtx.Provider>
}

export function useSync(): SyncApi {
  return useContext(SyncCtx)
}
