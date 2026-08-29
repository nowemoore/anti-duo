import { useState } from 'react'
import type { KanaTask } from '../../lib/kanaTasks'
import { KANA_TASK_TUNING } from '../../lib/kanaTaskTypes'
import { SentenceView, type TokenOverride } from '../SentenceView'
import { SpeakButton } from '../SpeakButton'
import { Feedback } from './Feedback'
import type { ReportResult } from './types'
import { QuizActions } from './QuizActions'

interface Props {
  task: KanaTask
  onResult: ReportResult
}

/**
 * A question about a kana word: four options, one prompt, same shell as the kanji choice tasks.
 *
 * The three kinds differ only in what stands above the options. `kana-spell` has no sentence — the
 * meaning is the prompt — while the other two put the word in a sentence: blanked out for a cloze,
 * highlighted for a meaning question.
 */
export function KanaTaskView({ task, onResult }: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [result, setResult] = useState<boolean | null>(null)
  const answered = result !== null

  /*
   * `forceJa` on both sentence kinds: an unmet kana word renders as English in ordinary reading, and
   * here that English *is* the answer. Once answered the token reverts to normal display, which is
   * the word in kana — the thing the question was teaching.
   */
  const override: TokenOverride = answered
    ? { highlight: true, forceJa: true }
    : task.kind === 'kana-cloze'
      ? { blankToken: true }
      : { highlight: true, forceJa: true, hideMeaning: true }

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
      <p className="task-prompt">{KANA_TASK_TUNING[task.kind].label}</p>

      {task.sentence && task.tokenIndex != null ? (
        <div className="task-sentence">
          <SentenceView
            tokens={task.sentence.tokens}
            overrides={{ [task.tokenIndex]: override }}
            revealMeanings={answered}
          />
          <SpeakButton
            text={task.sentence.tokens.map((t) => t.surface).join('')}
            label="Play sentence"
            className="sentence-speak"
            disabled={!answered}
          />
        </div>
      ) : (
        // No sentence: the meaning is the prompt, and the options are the spellings of it.
        <div className="task-sentence">
          <span className="task-gloss">{task.word.gloss.join(', ')}</span>
        </div>
      )}

      <ul className="option-grid">
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
            {/* Hearing the option is half of telling パン from バン, so every spelling is speakable. */}
            {task.kind !== 'kana-meaning' && (
              <SpeakButton text={o.label} label={`Play ${o.label}`} className="opt-speak" />
            )}
          </li>
        ))}
      </ul>

      <div className="feedback-slot">{answered && <Feedback correct={result} />}</div>

      <QuizActions
        answered={answered}
        canCheck={chosen !== null}
        onCheck={() => chosen !== null && setResult(task.options[chosen].correct)}
        onContinue={() =>
          onResult(result ? 1 : -1, { picked: chosen != null ? task.options[chosen].label : null })
        }
      />
    </div>
  )
}
