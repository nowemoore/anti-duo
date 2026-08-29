import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { DrawTask } from '../../lib/tasks'
import { useHandwriting } from '../../lib/useHandwriting'
import { DrawCanvas, type Stroke } from '../DrawCanvas'
import { SpeakButton } from '../SpeakButton'
import { Feedback } from './Feedback'
import { QuizActions } from './QuizActions'
import type { ReportResult } from './types'

interface Props {
  task: DrawTask
  onResult: ReportResult
}

/**
 * Draw the word from its reading, graded on-device by the handwriting recognizer.
 *
 * The recognizer is good but not infallible, so the verdict is appealable: after the reveal the
 * learner can overturn it in either direction, and their word is the one that scores. Without that
 * an unlucky misread would push a kanji's level down for a drawing that was actually right.
 */
export function DrawTaskView({ task, onResult }: Props) {
  // Already resolved by the time a draw task exists: the same module is what said this word could
  // be drawn in the first place.
  const hw = useHandwriting()
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [marks, setMarks] = useState<{ char: string; ok: boolean }[]>([])
  /** Set once the learner overturns the machine's verdict, so the button can't be pressed twice. */
  const [overridden, setOverridden] = useState(false)

  const revealed = score != null

  const check = () => {
    if (revealed || strokes.length === 0 || !hw) return
    const result = hw.scoreWord(task.word, strokes)
    setMarks(result.marks)
    setScore(result.correct ? 1 : -1)
  }

  const giveUp = () => {
    if (revealed) return
    setMarks([])
    setScore(-1)
  }

  return (
    <div className="task draw-task">
      {/*
        The prompt is the kana reading when there is one and the English meaning when there isn't;
        a fixed height either way, so a long meaning can't shove the canvas down the card.
      */}
      <p className={task.reading ? 'draw-prompt' : 'draw-prompt en'}>{task.reading || task.meaning}</p>

      <DrawCanvas
        disabled={revealed}
        onStrokes={setStrokes}
        onNoClue={giveUp}
        status={revealed ? (score > 0 ? 'right' : 'wrong') : undefined}
      />

      <div className="feedback-slot">
        {revealed && (
          <>
            <Feedback correct={score > 0} detail={score > 0 ? undefined : task.word} />
            {/* Per-character marks, so a wrong verdict says which character it read as wrong. */}
            {marks.length > 1 && (
              <p className="draw-marks">
                {marks.map((m, i) => (
                  <span key={i} className={m.ok ? 'draw-mark ok' : 'draw-mark'}>
                    {m.char}
                  </span>
                ))}
              </p>
            )}
            <p className="draw-answer">
              <span className="draw-answer-word">{task.word}</span>
              <SpeakButton text={task.reading || task.word} label={`Pronounce ${task.word}`} />
              <span className="draw-answer-meaning">{task.meaning}</span>
            </p>
          </>
        )}
      </div>

      <QuizActions
        answered={revealed}
        canCheck={strokes.length > 0}
        onCheck={check}
        onContinue={() =>
          // The strokes ride along so the session can file them in `drawings` and link the row.
          onResult(score ?? 0, { strokes, overrodeVerdict: overridden })
        }
        leftExtra={
          revealed && !overridden ? (
            // The appeal, in whichever direction the machine got it wrong.
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setOverridden(true)
                setScore(score > 0 ? -1 : 1)
              }}
            >
              <FontAwesomeIcon icon={score > 0 ? 'circle-xmark' : 'circle-check'} />
              {score > 0 ? 'Wait, I got this one wrong' : 'I think I got this one right'}
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
