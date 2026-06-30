import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchProgress, saveProgress } from '../lib/api'
import type { Progress } from '../../shared/types'

type Updater = Progress | ((prev: Progress) => Progress)

interface ProgressApi {
  progress: Progress
  /** Apply a change locally and persist it (debounced). */
  update: (next: Updater) => void
  saving: boolean
}

const ProgressCtx = createContext<ProgressApi | null>(null)

const SAVE_DEBOUNCE_MS = 400

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // `latest` is the source of truth for updates, avoiding stale closures / StrictMode double-runs.
  const latest = useRef<Progress | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    fetchProgress()
      .then((p) => {
        latest.current = p
        setProgress(p)
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const flush = useCallback(() => {
    if (!latest.current) return
    setSaving(true)
    saveProgress(latest.current)
      .then((saved) => {
        latest.current = saved
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false))
  }, [])

  const update = useCallback(
    (next: Updater) => {
      const prev = latest.current
      if (!prev) return
      const value = typeof next === 'function' ? next(prev) : next
      latest.current = value
      setProgress(value)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  if (error) return <div className="status status-error">Failed to load progress: {error}</div>
  if (!progress) return <div className="status">Loading progress…</div>
  return (
    <ProgressCtx.Provider value={{ progress, update, saving }}>{children}</ProgressCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress(): ProgressApi {
  const value = useContext(ProgressCtx)
  if (!value) throw new Error('useProgress must be used within ProgressProvider')
  return value
}
