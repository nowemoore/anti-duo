import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchContent } from '../lib/api'
import { buildContentIndex, type ContentIndex } from '../lib/content'

const ContentCtx = createContext<ContentIndex | null>(null)

export function ContentProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState<ContentIndex | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchContent()
      .then((c) => setIndex(buildContentIndex(c)))
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="status status-error">Failed to load content: {error}</div>
  if (!index) return <div className="status">Loading content…</div>
  return <ContentCtx.Provider value={index}>{children}</ContentCtx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContent(): ContentIndex {
  const value = useContext(ContentCtx)
  if (!value) throw new Error('useContent must be used within ContentProvider')
  return value
}
