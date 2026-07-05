import { ChoiceTaskView } from './ChoiceTaskView'
import { TypeWordTaskView } from './TypeWordTaskView'
import { WhichWordsTaskView } from './WhichWordsTaskView'
import { DrawKanjiTaskView } from './DrawKanjiTaskView'
import type { QA } from './types'
import type { RawStroke } from '../../lib/handwriting'

interface Props {
  qa: QA
  onChoose: (i: number) => void
  onToggle: (i: number) => void
  onChange: (v: string) => void
  onStrokes: (s: RawStroke[]) => void
  onLock: () => void
  onGiveUp: () => void
}

/** Renders the right controlled task view for a question. Answer state lives in the session. */
export function TaskRunner({ qa, onChoose, onToggle, onChange, onStrokes, onLock, onGiveUp }: Props) {
  switch (qa.task.kind) {
    case 'type-word':
      return (
        <TypeWordTaskView
          task={qa.task}
          value={qa.typed}
          phase={qa.phase}
          score={qa.score}
          onChange={onChange}
          onLock={onLock}
          onGiveUp={onGiveUp}
        />
      )
    case 'which-words':
      return <WhichWordsTaskView task={qa.task} selected={qa.selected} phase={qa.phase} onToggle={onToggle} />
    case 'draw-kanji':
      return (
        <DrawKanjiTaskView
          task={qa.task}
          revealed={qa.phase === 'revealed'}
          strokes={qa.strokes}
          onStrokes={onStrokes}
          onGiveUp={onGiveUp}
        />
      )
    default:
      return <ChoiceTaskView task={qa.task} chosen={qa.chosen} revealed={qa.phase === 'revealed'} onChoose={onChoose} />
  }
}
