import { useCallback } from 'react'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { isFormLearned } from './learned'

/** Returns `(char) => boolean`, reading the current content index + progress. */
export function useLearned(): (char: string) => boolean {
  const index = useContent()
  const { progress } = useProgress()
  return useCallback((char: string) => isFormLearned(char, index, progress), [index, progress])
}
