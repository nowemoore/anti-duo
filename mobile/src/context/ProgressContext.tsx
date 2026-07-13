import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchProgress, saveProgress } from '../lib/storage'
import type { Progress } from '@shared/types'
import { useLanguage } from './LanguageContext'
import { Status } from '../components/Status'

// Ported from src/context/ProgressContext.tsx. Only two web touch-points change: window.setTimeout
// → bare setTimeout (ref retyped), and the status <div>s → <Status>. The refs-as-source-of-truth
// + debounced-save logic transfers verbatim.
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
  const lang = useLanguage().id
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const latest = useRef<Progress | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchProgress(lang)
      .then((p) => {
        latest.current = p
        setProgress(p)
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [lang])

  const flush = useCallback(() => {
    if (!latest.current) return
    setSaving(true)
    saveProgress(lang, latest.current)
      .then((saved) => {
        latest.current = saved
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setSaving(false))
  }, [lang])

  const update = useCallback(
    (next: Updater) => {
      const prev = latest.current
      if (!prev) return
      const value = typeof next === 'function' ? next(prev) : next
      latest.current = value
      setProgress(value)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  if (error) return <Status text={`Failed to load progress: ${error}`} error />
  if (!progress) return <Status text="Loading progress…" />
  return (
    <ProgressCtx.Provider value={{ progress, update, saving }}>{children}</ProgressCtx.Provider>
  )
}

export function useProgress(): ProgressApi {
  const value = useContext(ProgressCtx)
  if (!value) throw new Error('useProgress must be used within ProgressProvider')
  return value
}
