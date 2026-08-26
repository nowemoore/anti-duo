import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { buildDrill, kanaOf, recordResult, type DrillItem } from '../../lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { useHandwriting } from '../../lib/useHandwriting'
import { useHandwritingInput } from '../../lib/useHandwritingInput'
import { Bilingual } from '../Bilingual'
import { DrawCanvas, type Stroke } from '../DrawCanvas'
import { useKanaAudio } from './audio'

/** What was answered. Doubles as the run's history, so answered questions can be paged back to. */
interface Answer {
  item: DrillItem
  correct: boolean
  /** Which option was clicked, so revisiting a question still shows the choice that was made. */
  picked?: string
}

/**
 * Listen and answer. Every question plays a sound — a single character or a short sequence — and the
 * learner picks which one it was.
 *
 * A character the learner has answered right enough times running is promoted from multiple choice
 * to write-from-memory, on the same canvas the kanji drills use — but only where there's something
 * to write with. Without a touchscreen or stylus, and until the recognizer has loaded, the run is
 * built with `allowDraw: false` and stays multiple choice however solid a character gets. See
 * `buildDrill`.
 */
export function KanaPractice({ onBack }: { onBack: () => void }) {
  const { progress, update } = useProgress()
  const play = useKanaAudio()
  const canWrite = useHandwritingInput()
  const hw = useHandwriting(canWrite)
  const drawReady = hw != null

  const [runId, setRunId] = useState(0)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  const items = useMemo(
    () => buildDrill(progress, { allowDraw: drawReady }),
    // `runId` is the reshuffle trigger; `progress` is deliberately excluded, or answering a question
    // would rebuild the list underneath the learner. `drawReady` only ever flips once, on the frame
    // the recognizer lands, and a run built before that simply stays multiple choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, drawReady],
  )

  const item = items[i]
  const done = items.length > 0 && i >= items.length
  // Derived, not stored: answers are appended in order, so answers[i] *is* question i's answer.
  const answered = answers[i] ?? null

  // Play each question as it arrives.
  useEffect(() => {
    if (item) play(item.target)
  }, [item, play])

  /** Mastery is written per answer rather than at the end, so quitting mid-run keeps the credit. */
  const resolve = (correct: boolean, picked?: string) => {
    if (!item || answered) return
    setAnswers((a) => [...a, { item, correct, picked }])
    update((p) => recordResult(p, item.chars, correct))
  }

  const restart = () => {
    setAnswers([])
    setI(0)
    setRunId((n) => n + 1)
  }

  if (items.length === 0) {
    return (
      <section className="panel kana-empty">
        <p>Open a character in one of the charts and mark it studied first.</p>
        <button type="button" className="pill-btn" onClick={onBack}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="chevron-left" />
          </span>
          Back to the charts
        </button>
      </section>
    )
  }

  if (done) return <Summary answers={answers} onRestart={restart} onBack={onBack} />

  const verdictClass = answered ? (answered.correct ? ' ok' : ' bad') : ''

  return (
    <section className={`panel practice kana-run${verdictClass}`}>
      <div className="practice-head">
        <button
          type="button"
          className="practice-back"
          onClick={onBack}
          aria-label="Back to the charts"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <Bilingual
          className="step"
          ja={`問題 ${i + 1} / ${items.length}`}
          en={`Question ${i + 1} / ${items.length}`}
        />
      </div>

      <div className="kana-dots">
        {items.map((_, n) => (
          <span
            key={n}
            className={`kana-dot${n === i ? ' on' : ''}${
              n < i ? (answers[n]?.correct ? ' good' : ' bad') : ''
            }`}
          />
        ))}
      </div>

      <div className="task-wrap" key={i}>
        <button
          type="button"
          className="kana-replay"
          onClick={() => play(item.target)}
          aria-label="Play the sound again"
        >
          <FontAwesomeIcon icon="volume-high" />
        </button>

        {item.format === 'draw' ? (
          <Draw key={i} item={item} answered={answered} onAnswer={resolve} />
        ) : (
          <Pick item={item} answered={answered} onAnswer={resolve} />
        )}
      </div>

      <div className="kana-pager">
        <button
          type="button"
          className="chevron"
          onClick={() => setI(Math.max(0, i - 1))}
          disabled={i === 0}
          aria-label="Previous question"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>

        {answered ? (
          <span className={`kana-verdict ${answered.correct ? 'ok' : 'bad'}`}>
            {answered.correct ? 'Correct' : 'Incorrect'}
          </span>
        ) : (
          <span className="kana-verdict-slot" />
        )}

        <button
          type="button"
          className="chevron next"
          onClick={() => setI(i + 1)}
          disabled={!answered}
          aria-label={i === items.length - 1 ? 'Finish' : 'Next question'}
        >
          <FontAwesomeIcon icon={i === items.length - 1 ? 'check' : 'chevron-right'} />
        </button>
      </div>
    </section>
  )
}

/**
 * Listen → pick. Options are pre-shuffled and guaranteed free of same-sounding entries, so there is
 * always exactly one answer that matches what was played.
 */
function Pick({
  item,
  answered,
  onAnswer,
}: {
  item: DrillItem
  answered: Answer | null
  onAnswer: (correct: boolean, picked?: string) => void
}) {
  // Read off the recorded answer rather than held locally, so paging back to a question still shows
  // which option was clicked.
  const picked = answered?.picked ?? null
  const reveal = answered != null

  return (
    <div className="kana-options">
      {item.options.map((o) => {
        // After answering, the right option is always marked — a wrong pick should show what was
        // right, not just that it was wrong.
        const state = !reveal ? '' : o.correct ? ' right' : picked === o.label ? ' wrong' : ' dead'
        return (
          <button
            key={o.label}
            type="button"
            className={`kana-option${state}${item.chars.length > 1 ? ' seq' : ''}`}
            disabled={reveal}
            onClick={() => onAnswer(o.correct, o.label)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Listen → write it unaided. The step up from picking: once a character is solid enough, the
 * question stops offering the answer among four and asks the learner to produce it.
 *
 * Graded by the same recognizer the kanji drills use, and appealable for the same reason — a
 * misread would otherwise walk back a character the learner actually knows.
 */
function Draw({
  item,
  answered,
  onAnswer,
}: {
  item: DrillItem
  answered: Answer | null
  onAnswer: (correct: boolean, picked?: string) => void
}) {
  const hw = useHandwriting()
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const reveal = answered != null

  const lockIn = () => {
    if (reveal || strokes.length === 0 || !hw) return
    onAnswer(hw.gradeKana(item.target, strokes))
  }

  return (
    <div className="kana-draw">
      <p className="kana-draw-hint">
        {reveal ? 'The answer is below' : 'Write what you heard — no options this time.'}
      </p>

      {/* No guide: the whole point is recalling the shape unaided. */}
      <DrawCanvas
        disabled={reveal}
        onStrokes={setStrokes}
        onNoClue={() => !reveal && onAnswer(false)}
        status={reveal ? (answered.correct ? 'right' : 'wrong') : undefined}
      />

      <div className="kana-draw-foot">
        {reveal ? (
          <p className="kana-draw-answer">{item.target}</p>
        ) : (
          <button type="button" className="write-lock" onClick={lockIn} disabled={strokes.length === 0 || !hw}>
            <FontAwesomeIcon icon="lock" />
            Lock in answer
          </button>
        )}
      </div>
    </div>
  )
}

function Summary({
  answers,
  onRestart,
  onBack,
}: {
  answers: Answer[]
  onRestart: () => void
  onBack: () => void
}) {
  const play = useKanaAudio()
  const right = answers.filter((a) => a.correct).length
  /*
   * The individual characters that let a question down, deduplicated.
   *
   * A missed sequence is evidence against every character in it, and listing the sequences instead
   * would put ねむ and ね in the list as if they were different things to revisit — they aren't, the
   * character is the unit of study here.
   */
  const missed = [...new Set(answers.filter((a) => !a.correct).flatMap((a) => a.item.chars))]

  return (
    <section className="panel summary">
      <h2>
        <Bilingual ja="おつかれさま" en="Nice run!" />
      </h2>

      <p className="kana-score">
        {right} / {answers.length}
        <span className="kana-score-sub">
          {Math.round((right / Math.max(1, answers.length)) * 100)}% this run
        </span>
      </p>

      {missed.length > 0 && (
        <div className="kana-missed">
          <h3>Worth another look</h3>
          <div className="kana-missed-row">
            {missed.map((char) => (
              /* The whole chip plays; the icon is a label, not a nested button. */
              <button
                key={char}
                type="button"
                className="kana-missed-chip"
                onClick={() => play(char)}
                aria-label={`Pronounce ${char}`}
              >
                <span className="kana-missed-top">
                  <span className="kana-missed-char">{char}</span>
                  <FontAwesomeIcon icon="volume-high" />
                </span>
                <span className="kana-missed-sub">{kanaOf(char)?.romaji ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Carrying on is the likelier next step, so it takes the accent; leaving is the quiet one. */}
      <div className="actions">
        <button type="button" className="pill-btn quiet" onClick={onBack}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="chevron-left" />
          </span>
          Back to studying
        </button>
        <button type="button" className="pill-btn" onClick={onRestart}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="rotate-left" />
          </span>
          Keep practising
        </button>
      </div>
    </section>
  )
}
