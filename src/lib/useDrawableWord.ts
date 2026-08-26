import { useCallback } from 'react'
import { useHandwriting } from './useHandwriting'
import { useHandwritingInput } from './useHandwritingInput'
import { useLearned } from './useLearned'

/**
 * A word may be a WRITE (draw) target only if the recognizer can grade it AND every character in it
 * is a learned unit — you can't be asked to produce a unit you haven't studied. (Recognition tasks
 * have no such rule.)
 *
 * Returns false for everything on a device with no touchscreen or stylus — a mouse is a poor stylus,
 * and a drawing question answered with one tests your wrist rather than the kanji. Also false while
 * the recognizer is still loading, so a draw task is never generated before the canvas could grade
 * it; in practice the chunk lands long before a session needs it.
 */
export function useDrawableWord(): (word: string) => boolean {
  const isLearned = useLearned()
  const canWrite = useHandwritingInput()
  const hw = useHandwriting(canWrite)
  return useCallback(
    (w: string) => canWrite && !!hw && hw.drawable(w) && [...w].every((c) => isLearned(c)),
    [isLearned, hw, canWrite],
  )
}
