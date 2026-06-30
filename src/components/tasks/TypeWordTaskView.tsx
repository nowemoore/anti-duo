import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { checkTypeWord, type TypeWordTask } from '../../lib/tasks'
import { HoverGloss } from '../HoverGloss'
import { SpeakButton } from '../SpeakButton'
import { Feedback } from './Feedback'
import { QuizActions } from './QuizActions'

interface Props {
  task: TypeWordTask
  onResult: (delta: number) => void
}

/** T1: show a word, type its reading in kana. */
export function TypeWordTaskView({ task, onResult }: Props) {
  const [value, setValue] = useState('')
  const [result, setResult] = useState<boolean | null>(null)

  const submit = () => {
    if (result !== null || !value.trim()) return
    setResult(checkTypeWord(task, value))
  }

  return (
    <div className="task type-word">
      <div className="prompt-word">
        {/* Meaning hint and pronunciation are only available once the answer is in. */}
        <HoverGloss gloss={task.meaning} enabled={result !== null}>
          {task.word}
        </HoverGloss>
        <SpeakButton
          text={task.reading}
          label={`Pronounce ${task.word}`}
          className="prompt-speak"
          disabled={result === null}
        />
      </div>

      <input
        autoFocus
        lang="ja"
        className="kana-input"
        placeholder="かな"
        value={value}
        disabled={result !== null}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && result === null) {
            e.preventDefault()
            submit()
          }
        }}
      />

      <div className="feedback-slot">
        {result !== null && (
          <Feedback correct={result} detail={result ? undefined : task.reading} />
        )}
      </div>

      <QuizActions
        answered={result !== null}
        canCheck={value.trim() !== ''}
        onCheck={submit}
        onContinue={() => onResult(result ? 1 : -1)}
        leftExtra={
          result === null ? (
            <button type="button" className="ghost" onClick={() => setResult(false)}>
              <FontAwesomeIcon icon="skull" />
              No clue
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
