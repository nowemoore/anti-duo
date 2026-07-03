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

type Phase = 'first' | 'retry' | 'revealed'

/** T1: show a word, type its reading in kana. One redo before the answer is revealed. */
export function TypeWordTaskView({ task, onResult }: Props) {
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<Phase>('first')
  const [score, setScore] = useState(0)

  const revealed = phase === 'revealed'

  // First correct = full credit; correct on the redo = half; still wrong (or "No clue") = a miss.
  // A wrong first try goes to 'retry' without revealing the answer, so the learner can fix a typo.
  const check = () => {
    if (revealed || !value.trim()) return
    if (checkTypeWord(task, value)) {
      setScore(phase === 'first' ? 1 : 0.5)
      setPhase('revealed')
    } else if (phase === 'first') {
      setPhase('retry')
    } else {
      setScore(-1)
      setPhase('revealed')
    }
  }

  const giveUp = () => {
    setScore(-1)
    setPhase('revealed')
  }

  return (
    <div className="task type-word">
      <div className="prompt-word">
        {/* Meaning hint and pronunciation are only available once the answer is in. */}
        <HoverGloss gloss={task.meaning} enabled={revealed}>
          {task.word}
        </HoverGloss>
        <SpeakButton
          text={task.reading}
          label={`Pronounce ${task.word}`}
          className="prompt-speak"
          disabled={!revealed}
        />
      </div>

      <input
        autoFocus
        lang="ja"
        className="kana-input"
        placeholder="かな"
        value={value}
        disabled={revealed}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !revealed) {
            e.preventDefault()
            check()
          }
        }}
      />

      <div className="feedback-slot">
        {phase === 'retry' && (
          <p className="retry-note">Not quite — fix your answer and check once more.</p>
        )}
        {revealed && (
          <Feedback correct={score > 0} detail={score > 0 ? undefined : task.reading} />
        )}
      </div>

      <QuizActions
        answered={revealed}
        canCheck={value.trim() !== ''}
        onCheck={check}
        onContinue={() => onResult(score)}
        leftExtra={
          !revealed ? (
            <button type="button" className="ghost" onClick={giveUp}>
              <FontAwesomeIcon icon="skull" />
              No clue
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
