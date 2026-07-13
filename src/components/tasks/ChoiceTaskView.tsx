import { useState } from 'react'
import { checkChoice, type ChoiceTask } from '../../lib/tasks'
import { SentenceView, type TokenOverride } from '../SentenceView'
import { SpeakButton } from '../SpeakButton'
import { Feedback } from './Feedback'
import { QuizActions } from './QuizActions'

interface Props {
  task: ChoiceTask
  onResult: (delta: number) => void
}

/** Speakable surface form of a sentence (particles as kana, words as their ja). */
function sentenceSpeech(task: ChoiceTask): string {
  return task.sentence.tokens.map((t) => (t.kind === 'particle' ? t.surface : t.surface)).join('')
}

/** T3a/b/c: read the sentence, pick one option. */
export function ChoiceTaskView({ task, onResult }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const answered = result !== null
  const isCloze = task.kind === 'cloze'
  const isPickReading = task.kind === 'pick-reading'

  let override: TokenOverride
  if (isCloze) {
    // Blank the char while answering; reveal the full word (furigana) once answered.
    override = answered ? { forceJaFurigana: true, highlight: true } : { blankChar: task.blankChar }
  } else if (task.kind === 'pick-reading') {
    override = { highlight: true, hideReading: true }
  } else {
    override = { highlight: true, hideMeaning: true }
  }
  const overrides = { [task.tokenIndex]: override }

  const optionClass = (i: number, correct: boolean) => {
    let c = 'opt'
    if (chosen === i) c += ' selected'
    if (answered) {
      if (correct) c += ' reveal-correct'
      else if (chosen === i) c += ' reveal-wrong'
    }
    return c
  }

  return (
    <div className="task choice">
      <div className="task-sentence">
        <SentenceView
          tokens={task.sentence.tokens}
          overrides={overrides}
          revealMeanings={answered}
        />
        {/* Play the whole phrase — space reserved up front (faint), clickable once answered. */}
        <SpeakButton
          text={sentenceSpeech(task)}
          label="Play sentence"
          className="sentence-speak"
          disabled={!answered}
        />
      </div>

      <ul className={isCloze ? 'option-grid cloze-options' : 'option-grid'}>
        {task.options.map((o, i) => (
          <li key={i} className="opt-cell">
            <button
              type="button"
              className={optionClass(i, o.correct)}
              onClick={() => !answered && setChosen(i)}
              disabled={answered}
            >
              {o.label}
            </button>
            {/* pick-reading: each option is a reading — let the learner hear it. */}
            {isPickReading && (
              <SpeakButton text={o.label} label={`Play ${o.label}`} className="opt-speak" />
            )}
          </li>
        ))}
      </ul>

      <div className="feedback-slot">{answered && <Feedback correct={result} />}</div>

      <QuizActions
        answered={answered}
        canCheck={chosen !== null}
        onCheck={() => chosen !== null && setResult(checkChoice(task, chosen))}
        onContinue={() => onResult(result ? 1 : -1)}
      />
    </div>
  )
}
