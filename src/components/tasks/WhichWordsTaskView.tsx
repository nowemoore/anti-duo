import { useState } from 'react'
import {
  isWhichWordsPerfect,
  scoreWhichWords,
  WHICH_WORDS_OPTIONS,
  WHICH_WORDS_POINT,
  type WhichWordsTask,
} from '../../lib/tasks'
import { HoverGloss } from '../HoverGloss'
import { SpeakButton } from '../SpeakButton'
import { Feedback } from './Feedback'
import { QuizActions } from './QuizActions'

interface Props {
  task: WhichWordsTask
  onResult: (delta: number) => void
}

type Phase = 'first' | 'retry' | 'revealed'

const MAX_SCORE = WHICH_WORDS_OPTIONS * WHICH_WORDS_POINT

/** T2: multi-select the real words. One redo allowed before the answer is revealed; ±0.25 per option. */
export function WhichWordsTaskView({ task, onResult }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [phase, setPhase] = useState<Phase>('first')
  const [score, setScore] = useState(0)

  const revealed = phase === 'revealed'

  const toggle = (i: number) => {
    if (revealed) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const check = () => {
    if (phase === 'first' && !isWhichWordsPerfect(task, selected)) {
      setPhase('retry')
      return
    }
    setScore(scoreWhichWords(task, selected))
    setPhase('revealed')
  }

  const optionClass = (i: number, correct: boolean) => {
    let c = 'opt'
    if (selected.has(i)) c += ' selected'
    if (revealed) {
      if (correct) c += ' reveal-correct'
      else if (selected.has(i)) c += ' reveal-wrong'
    }
    return c
  }

  return (
    <div className="task which-words">
      {/* No meaning shown here: this task tests which words are real, not the kanji's meaning. */}
      <div className="prompt-kanji">{task.char}</div>

      <ul className="option-grid">
        {task.options.map((o, i) => (
          <li key={i} className="opt-cell">
            <button
              type="button"
              className={optionClass(i, o.correct)}
              onClick={() => toggle(i)}
              disabled={revealed}
            >
              {/* Hover shows the reading while choosing; after the reveal, greens show reading · meaning. */}
              <HoverGloss
                gloss={revealed ? `${o.reading}  ·  ${o.meaning}` : o.reading}
                enabled={revealed ? o.correct : true}
              >
                <span className="opt-word">{o.word}</span>
              </HoverGloss>
            </button>
            {/* After answering, hear the real (green) words. */}
            {revealed && o.correct && (
              <SpeakButton text={o.reading} label={`Play ${o.word}`} className="opt-speak" />
            )}
          </li>
        ))}
      </ul>

      <div className="feedback-slot">
        {phase === 'retry' && (
          <p className="retry-note">Not quite — adjust your selection and check once more.</p>
        )}
        {revealed && (
          <Feedback
            correct={score >= MAX_SCORE}
            detail="hover or hold a green word for reading & meaning"
          />
        )}
      </div>

      <QuizActions
        answered={revealed}
        canCheck={!revealed}
        onCheck={check}
        onContinue={() => onResult(score)}
      />
    </div>
  )
}
