import type { FC } from 'react'
import type { Task } from '@lib/tasks'
import { useLanguage } from '../../context/LanguageContext'
import { getTaskUI } from './registry'
import type { QA, TaskViewProps } from './types'

interface Props {
  qa: QA
  setAnswer: (a: unknown) => void
  onLock: () => void
  onGiveUp: () => void
}

/** Renders the active task's view, looked up from the registry (built-in or pack-contributed). */
export function TaskRunner({ qa, setAnswer, onLock, onGiveUp }: Props) {
  const pack = useLanguage()
  const ui = getTaskUI(qa.task.kind, pack)
  if (!ui) return null
  // Both halves of the union are cast away here: the registry entry was looked up by the very kind
  // that decides which half this is, so the pairing is right by construction and unprovable to TS.
  const TaskView = ui.View as FC<TaskViewProps>
  return (
    <TaskView
      task={qa.task as Task}
      answer={qa.answer}
      setAnswer={setAnswer}
      phase={qa.phase}
      score={qa.score}
      onLock={onLock}
      onGiveUp={onGiveUp}
    />
  )
}
