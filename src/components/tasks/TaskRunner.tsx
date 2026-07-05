import type { Task } from '../../lib/tasks'
import { ChoiceTaskView } from './ChoiceTaskView'
import { TypeWordTaskView } from './TypeWordTaskView'
import { WhichWordsTaskView } from './WhichWordsTaskView'

interface Props {
  task: Task
  /** Reports the score delta to add to the target kanji's level. */
  onResult: (delta: number) => void
}

/** Renders the right component for a task and reports the result back. */
export function TaskRunner({ task, onResult }: Props) {
  switch (task.kind) {
    case 'type-word':
      return <TypeWordTaskView task={task} onResult={onResult} />
    case 'which-words':
      return <WhichWordsTaskView task={task} onResult={onResult} />
    case 'draw-kanji':
      // The web build has no drawing surface; draw tasks are mobile-only and never generated here.
      return null
    default:
      return <ChoiceTaskView task={task} onResult={onResult} />
  }
}
