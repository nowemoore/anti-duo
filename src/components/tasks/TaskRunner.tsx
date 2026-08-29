import type { Task } from '../../lib/tasks'
import type { ReportResult } from './types'
import { ChoiceTaskView } from './ChoiceTaskView'
import { DrawTaskView } from './DrawTaskView'
import { TypeWordTaskView } from './TypeWordTaskView'
import { WhichWordsTaskView } from './WhichWordsTaskView'

interface Props {
  task: Task
  /** Reports the score delta to add to the target kanji's level, plus what was answered. */
  onResult: ReportResult
}

/** Renders the right component for a task and reports the result back. */
export function TaskRunner({ task, onResult }: Props) {
  switch (task.kind) {
    case 'type-word':
      return <TypeWordTaskView task={task} onResult={onResult} />
    case 'which-words':
      return <WhichWordsTaskView task={task} onResult={onResult} />
    case 'draw':
      return <DrawTaskView task={task} onResult={onResult} />
    case 'plural':
    case 'root-cloze':
      // Opt-in, and no language here supplies the data — so neither is ever generated.
      return null
    default:
      return <ChoiceTaskView task={task} onResult={onResult} />
  }
}
