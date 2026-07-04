import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { bind, toKana, unbind } from 'wanakana'
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

/** T1: show a word, type its reading in kana. Romaji is converted to kana live. One redo before reveal. */
export function TypeWordTaskView({ task, onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [hasValue, setHasValue] = useState(false)
  const [phase, setPhase] = useState<Phase>('first')
  const [score, setScore] = useState(0)

  const revealed = phase === 'revealed'

  // Live romaji→kana so no Japanese keyboard is needed. wanakana's input binding tracks the raw
  // romaji buffer, so it gets the tricky cases right (ん before a な-row syllable as in "onna",
  // sokuon, caret position) that converting the field value on each change cannot. The task view is
  // remounted per question (PracticeSession keys it on the iteration), so bind/unbind pairs cleanly.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    bind(el, { IMEMode: true })
    return () => unbind(el)
  }, [])

  // First correct = full credit; correct on the redo = half; still wrong (or "No clue") = a miss.
  // A wrong first try goes to 'retry' without revealing the answer, so the learner can fix a typo.
  const check = () => {
    const el = inputRef.current
    if (revealed || !el || !el.value.trim()) return
    // Flush any half-typed romaji (a trailing lone "n" stays pending in IME mode → ん) before checking.
    const answer = toKana(el.value)
    if (checkTypeWord(task, answer)) {
      el.value = answer // reveal path: input is about to be disabled, so clean up the display
      setScore(phase === 'first' ? 1 : 0.5)
      setPhase('revealed')
    } else if (phase === 'first') {
      setPhase('retry') // leave the field as typed so the learner can edit (don't desync the buffer)
    } else {
      el.value = answer
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
        ref={inputRef}
        autoFocus
        lang="ja"
        className="kana-input"
        placeholder="かな / romaji"
        disabled={revealed}
        onInput={() => setHasValue((inputRef.current?.value.trim() ?? '') !== '')}
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
        canCheck={hasValue}
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
