import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchContent } from '../lib/storage'
import { buildContentIndex, type ContentIndex } from '@lib/content'
import { useLanguage } from './LanguageContext'
import { Status } from '../components/Status'

// Ported near-verbatim from src/context/ContentContext.tsx — only the loading/error UI changes
// (RN <Status> instead of status <div>s). Content is now per-language: it re-loads whenever the
// active language changes (its bundled payload selects the engine via content.lang).
const ContentCtx = createContext<ContentIndex | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const lang = useLanguage().id
  const [index, setIndex] = useState<ContentIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setError(null)
    // Don't blank the index while swapping languages — keep the current content mounted until the new
    // one is built (bundled content resolves within a microtask), so there's no "Loading…" flash. The
    // shell crossfades the swap. The loading state only shows on the very first load (index still null).
    fetchContent(lang)
      .then((c) => alive && setIndex(buildContentIndex(c)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [lang])

  if (error) return <Status text={`Failed to load content: ${error}`} error />
  if (!index) return <Status text="Loading content…" />
  return <ContentCtx.Provider value={index}>{children}</ContentCtx.Provider>
}

export function useContent(): ContentIndex {
  const value = useContext(ContentCtx)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
