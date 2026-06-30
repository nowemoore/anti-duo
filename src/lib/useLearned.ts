import { useCallback } from 'react'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { isCharLearned } from './learned'

/** Returns `(char) => boolean`, reading the current content index + progress. */
export function useLearned(): (char: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  return useCallback((char: string) => isCharLearned(char, index, progress), [index, progress])
}
