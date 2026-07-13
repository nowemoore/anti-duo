import { useCallback } from 'react'
import { useLearned } from './useLearned'
import { useLanguage } from '../context/LanguageContext'

/**
 * A word may be a WRITE (draw) target only if the active language can grade it AND every character in
 * it is a learned unit — you can't be asked to produce a unit you haven't studied. Languages with no
 * draw capability never yield a target. (Recognition tasks have no such rule.)
 */
export function useDrawableWord(): (word: string) => boolean {
  const isLearned = useLearned()
  const { draw } = useLanguage()
  return useCallback(
    (w: string) => !!draw && draw.isDrawable(w) && [...w].every((c) => isLearned(c)),
    [isLearned, draw],
  )
}
