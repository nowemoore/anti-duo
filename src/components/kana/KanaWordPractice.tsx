import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { buildWordDrill, charsOf, recordResult, type WordItem } from '../../lib/kana'
import type { KanaWord } from '../../../shared/types'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { Bilingual } from '../Bilingual'
import { SpeakButton } from '../SpeakButton'
import { useWordAudio } from './audio'

/** What was answered. Doubles as the run's history, so answered questions can be paged back to. */
interface Answer {
  item: WordItem
  correct: boolean
  /** Which option was clicked, so revisiting a question still shows the choice that was made. */
  picked?: string
}

/**
 * Read whole words made of characters you already know.
 *
 * The sibling of {@link KanaPractice}: that one teaches sound→shape one glyph at a time, this one
 * puts the same glyphs into real words, where the mistakes are long vowels, small kana and voicing
 * marks. Deliberately built to the same layout — dots, a card that takes the verdict colour, the
 * same pager — so moving between the two doesn't feel like moving between two apps.
 *
 * **Every word shown is one the learner can actually read**: `buildWordDrill` only ever draws from
 * words whose every chart entry has been studied, so this can never ask about a character that
 * hasn't been met. See `src/lib/kana/words.ts`.
 */
export function KanaWordPractice({ onBack }: { onBack: () => void }) {
  const { progress, update } = useProgress()
  const play = useWordAudio()
  const kanaWords = useContent().content.kanaWords ?? []

  const [runId, setRunId] = useState(0)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  const items = useMemo(
    () => buildWordDrill(progress, kanaWords),
    // `runId` is the reshuffle trigger; `progress` is deliberately excluded, or answering a question
    // would rebuild the list underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, kanaWords],
  )

  const item = items[i]
  const done = items.length > 0 && i >= items.length
  // Derived, not stored: answers are appended in order, so answers[i] *is* question i's answer.
  const answered = answers[i] ?? null

  // Spelling questions are listening questions: the word is spoken and the options differ only in
  // how they're written. A meaning question shows the word, so speaking it would give it away.
  useEffect(() => {
    if (item?.format === 'spell') play(item.word.word)
  }, [item, play])

  /**
   * Credit every character of the word, not the word itself.
   *
   * Reading パン correctly is evidence for パ and ン, and those are what the chart tracks — there is
   * no per-word mastery here. It's the same call the character drill makes for a sequence, so a word
   * run and a character run feed the same progress.
   */
  const resolve = (correct: boolean, picked?: string) => {
    if (!item || answered) return
    setAnswers((a) => [...a, { item, correct, picked }])
    update((p) => recordResult(p, charsOf(item.word.word), correct))
  }

  const restart = () => {
    setAnswers([])
    setI(0)
    setRunId((n) => n + 1)
  }

  if (items.length === 0) {
    return (
      <section className="panel kana-empty">
        <p>Study a few more characters in the charts, then whole words unlock here.</p>
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
        {item.format === 'spell' ? (
          <>
            <button
              type="button"
              className="kana-replay"
              onClick={() => play(item.word.word)}
              aria-label="Play the word again"
            >
              <FontAwesomeIcon icon="volume-high" />
            </button>
            {/* The meaning is the prompt: it says *which* word without spelling it. */}
            <p className="kana-word-prompt">{item.word.gloss[0] ?? ''}</p>
          </>
        ) : (
          /* The word is on screen, so hearing it gives nothing away — and a learner who can read it
             but has never heard it has only half of it. */
          <p className="kana-word-row">
            <span className="kana-word">{item.word.word}</span>
            <SpeakButton text={item.word.word} label={`Pronounce ${item.word.word}`} />
          </p>
        )}

        <Options item={item} answered={answered} onAnswer={resolve} />
      </div>

      {/* Between the question and the pager, and only once the answer is in — several notes say what
          a word is *not* (コンセント is not "consent"), which would hand over the answer if it were on
          screen while the question was still open. */}
      {answered && item.word.note && (
        <p className="kana-note">
          <FontAwesomeIcon icon="circle-info" />
          <span>{item.word.note}</span>
        </p>
      )}

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

/** The option list. Pre-shuffled by the generator, so presentation order carries no information. */
function Options({
  item,
  answered,
  onAnswer,
}: {
  item: WordItem
  answered: Answer | null
  onAnswer: (correct: boolean, picked?: string) => void
}) {
  const picked = answered?.picked ?? null

  return (
    <div className="kana-options words">
      {item.options.map((opt) => {
        const chosen = picked === opt.label
        // After answering, the right option is always marked — a wrong pick should show what was
        // right, not just that it was wrong.
        const state = !answered ? '' : opt.correct ? ' right' : chosen ? ' wrong' : ' dead'
        return (
          /* The speak control is a sibling of the option, never a child: a button inside a button is
             invalid HTML, and the two would fight over the same click. */
          <div key={opt.label} className="kana-option-wrap">
            <button
              type="button"
              // Spelling options are Japanese and want the larger face; meanings are English prose.
              className={`kana-option ${item.format === 'spell' ? 'spell' : 'meaning'}${state}`}
              disabled={answered != null}
              onClick={() => onAnswer(opt.correct, opt.label)}
            >
              {opt.label}
            </button>
            {/* Once the answer is out, the word you just placed is the thing you most want to hear
                said back. Only on the revealed spelling: before that it would read every option
                aloud, and on a meaning question the option is English. */}
            {state === ' right' && item.format === 'spell' && (
              <SpeakButton text={opt.label} label={`Pronounce ${opt.label}`} />
            )}
          </div>
        )
      })}
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
  const play = useWordAudio()
  const right = answers.filter((a) => a.correct).length

  /**
   * The words that let the learner down, deduplicated by word.
   *
   * Unlike the character run, the word *is* the unit of study here — two misses of パン are one thing
   * to revisit, but パン and パーティー are two, even though they share a character.
   */
  const missed = [
    ...new Map(
      answers.filter((a) => !a.correct).map((a) => [a.item.word.idx, a.item.word]),
    ).values(),
  ]

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
            {missed.map((w: KanaWord) => (
              /* The whole chip plays, so the icon is a label rather than a nested button — two
                 targets one inside the other is worse than none. */
              <button
                key={w.idx}
                type="button"
                className="kana-missed-chip"
                onClick={() => play(w.word)}
                aria-label={`Pronounce ${w.word}`}
              >
                <span className="kana-missed-top">
                  <span className="kana-missed-char word">{w.word}</span>
                  <FontAwesomeIcon icon="volume-high" />
                </span>
                <span className="kana-missed-sub">{w.gloss[0] ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
