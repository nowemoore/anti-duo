import { useCallback } from 'react'
import { useLearned } from './useLearned'
import { drawable } from '../lib/handwriting'

/**
 * A word may be a WRITE (draw) target only if it is drawable AND every kanji in it has been learned
 * — you can't be asked to produce a kanji you haven't studied. (Recognition tasks have no such rule.)
 */
export function useDrawableWord(): (word: string) => boolean {
  const isLearned = useLearned()
  return useCallback((w: string) => drawable(w) && [...w].every((c) => isLearned(c)), [isLearned])
}
