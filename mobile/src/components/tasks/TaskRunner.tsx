import { useLanguage } from '../../context/LanguageContext'
import { getTaskUI } from './registry'
import type { QA } from './types'

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
  const TaskView = ui.View
  return (
    <TaskView
      task={qa.task}
      answer={qa.answer}
      setAnswer={setAnswer}
      phase={qa.phase}
      score={qa.score}
      onLock={onLock}
      onGiveUp={onGiveUp}
    />
  )
}
