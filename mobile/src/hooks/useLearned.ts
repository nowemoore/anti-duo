import { useCallback, useMemo } from 'react'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { isWordMet } from '@lib/kana'
import { isFormLearned } from '@lib/learned'

/** Returns `(char) => boolean`, reading the current content index + progress (mobile contexts). */
export function useLearned(): (char: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  return useCallback((char: string) => isFormLearned(char, index, progress), [index, progress])
}

/**
 * Returns `(surface) => boolean`: whether this kana word has been met.
 *
 * Only kana words are tracked this way, so a surface that isn't one answers false — callers pair it
 * with `nativeWhenUntracked`, which has already established the surface has no unit behind it. Built
 * as a set per progress change rather than scanned per token: a sentence asks this of every word it
 * renders, and the kana list is ~300 long.
 */
export function useMetWord(): (surface: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  const met = useMemo(() => {
    const out = new Set<string>()
    for (const w of index.content.kanaWords ?? []) if (isWordMet(progress, w.idx)) out.add(w.word)
    return out
  }, [index, progress])
  return useCallback((surface: string) => met.has(surface), [met])
}
