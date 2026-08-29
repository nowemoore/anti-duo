import { useCallback, useMemo } from 'react'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { isWordMet } from './kana'
import { isFormLearned } from './learned'

/** Returns `(char) => boolean`, reading the current content index + progress. */
export function useLearned(): (char: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  return useCallback((char: string) => isFormLearned(char, index, progress), [index, progress])
}

/**
 * Returns `(surface) => boolean`: whether this kana word has been met.
 *
 * Only kana words are tracked this way, so a surface that isn't one answers false — callers pair it
 * with `nativeWhenUntracked`, which has already established that the surface has no unit behind it.
 */
export function useMetWord(): (surface: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  // Built once per progress change rather than scanned per token: a sentence asks this of every word
  // it renders, and the kana list is ~300 long.
  const met = useMemo(() => {
    const out = new Set<string>()
    for (const w of index.content.kanaWords ?? []) if (isWordMet(progress, w.idx)) out.add(w.word)
    return out
  }, [index, progress])
  return useCallback((surface: string) => met.has(surface), [met])
}
