import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchContent } from '../lib/storage'
import { buildContentIndex, type ContentIndex } from '@lib/content'
import { Status } from '../components/Status'

// Ported near-verbatim from src/context/ContentContext.tsx — only the loading/error UI changes
// (RN <Status> instead of status <div>s). buildContentIndex + fetchContent do the work.
const ContentCtx = createContext<ContentIndex | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<ContentIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchContent()
      .then((c) => setIndex(buildContentIndex(c)))
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <Status text={`Failed to load content: ${error}`} error />
  if (!index) return <Status text="Loading content…" />
  return <ContentCtx.Provider value={index}>{children}</ContentCtx.Provider>
}

export function useContent(): ContentIndex {
  const value = useContext(ContentCtx)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
