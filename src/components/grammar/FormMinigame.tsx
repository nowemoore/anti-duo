import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { GrammarItemResult } from '../../../shared/types'
import { GRAMMAR_PASS_ACCURACY } from '../../../shared/constants'
import {
  maxVisitableIndex,
  prepareAttempt,
  type GrammarContext,
  type GrammarTopic,
  type PreparedItem,
} from '../../lib/grammar'
import { Furigana } from '../Furigana'
import { RevealStrip } from '../RevealStrip'

/** Page 0 is the framing slide; questions are pages 1..n. */
const INTRO_PAGE = 0

/**
 * Both options share one font size — the size that fits the *longer* of the two — so a long form
 * never renders smaller than its partner and the pair always reads as a fair comparison. Kana are
 * effectively full-width, so character count is a good width proxy. Expressed in rem against the
 * fluid root size, so it scales with the rest of the UI instead of being pinned to pixels.
 */
function optionFontSize(labels: string[]): string {
  const longest = Math.max(...labels.map((l) => l.length), 1)
  // Each option is half the card minus padding; ~9 full-width characters fit at the base size.
  return `clamp(0.75rem, ${(9 / longest).toFixed(2)}rem, 1.4rem)`
}

/**
 * Part 2 — binary choice. The verb sits inside the sentence frame, faint and bracketed, so it reads
 * as "this is the thing you're replacing"; the two candidate 〜ます forms sit side by side below.
 *
 * Navigation is entirely manual: answering an item never advances the card. Use the chevrons or the
 * arrow keys to move in either direction, finish explicitly, and go back to browse afterwards.
 */
export function FormMinigame({
  topic,
  ctx,
  onFinish,
}: {
  topic: GrammarTopic
  /** Content + progress, for topics whose items are derived from what the learner knows. */
  ctx: GrammarContext
  /** Called once per completed run, with the whole attempt's per-item results. */
  onFinish: (results: GrammarItemResult[]) => void
}) {
  // Prepared once and replaced wholesale on retry, so a reshuffle is explicit. Freezing it also
  // means the progress write at the end of a run can't reshape the run being played.
  const [prepared, setPrepared] = useState<PreparedItem[]>(() => prepareAttempt(topic, ctx))
  const [answers, setAnswers] = useState<(number | null)[]>(() => prepared.map(() => null))
  const hasIntro = Boolean(topic.minigame.intro)
  const [page, setPage] = useState(hasIntro ? INTRO_PAGE : 1)
  /** 'run' = the pager, 'summary' = the score card. Toggling between them never re-records. */
  const [view, setView] = useState<'run' | 'summary'>('run')
  const recorded = useRef(false)
  // Text held in the reveal strip, or null for the hint. Cleared on release and on navigation.
  const [revealed, setRevealed] = useState<string | null>(null)
  /** Which way the last move went, so the incoming card slides in from the side we came from. */
  const [dir, setDir] = useState<'next' | 'prev'>('next')

  const onIntro = page === INTRO_PAGE
  const i = page - 1
  const current = prepared[i]
  const picked = onIntro ? null : answers[i]
  const remaining = answers.filter((a) => a == null).length

  // Back is always open; forward stops at the first unanswered item, so you can step one ahead but
  // never skip a question. The intro is always passable — there's nothing to answer on it.
  const lastPage = maxVisitableIndex(answers) + 1
  const canGoPrev = page > (hasIntro ? INTRO_PAGE : 1)
  const canGoNext = page < lastPage

  const goPrev = () => {
    if (!canGoPrev) return
    setRevealed(null)
    setDir('prev')
    setPage((n) => n - 1)
  }
  const goNext = () => {
    if (!canGoNext) return
    setRevealed(null)
    setDir('next')
    setPage((n) => n + 1)
  }

  // Arrow keys page the run, standing in for the phone's swipe. Ignored while a text field has
  // focus, so the reflection below can still be typed in.
  const nav = useRef({ goPrev, goNext })
  nav.current = { goPrev, goNext }
  useEffect(() => {
    if (view !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') nav.current.goPrev()
      if (e.key === 'ArrowRight') nav.current.goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view])

  /** Answers are locked in on first choice, so revisiting an item can't be used to fix a miss. */
  function choose(optionIndex: number) {
    if (onIntro || answers[i] != null) return
    setAnswers((prev) => prev.map((a, n) => (n === i ? optionIndex : a)))
  }

  function finish() {
    // Record the attempt exactly once; returning here from a review must not log it again.
    if (!recorded.current) {
      recorded.current = true
      onFinish(
        prepared.map((p, n) => {
          const option = p.options[answers[n]!]
          return { itemId: p.item.id, correct: option.correct, picked: option.label }
        }),
      )
    }
    setView('summary')
  }

  function retry() {
    const next = prepareAttempt(topic, ctx)
    recorded.current = false
    setPrepared(next)
    setAnswers(next.map(() => null))
    setPage(hasIntro ? INTRO_PAGE : 1)
    setView('run')
  }

  if (view === 'summary') {
    const correct = prepared.filter((p, n) => p.options[answers[n]!]?.correct).length
    const accuracy = correct / prepared.length
    const passed = accuracy >= GRAMMAR_PASS_ACCURACY
    return (
      <div className="game-summary">
        <p className="game-score">
          {correct}
          <span className="game-score-of">/ {prepared.length}</span>
        </p>
        <p className="game-score-pct">{Math.round(accuracy * 100)}% correct</p>
        <p className="game-score-note">
          {passed
            ? 'Nice — the explanation unlocks once you finish the reflection below.'
            : `${Math.round(GRAMMAR_PASS_ACCURACY * 100)}% unlocks the explanation. Your best attempt counts, so a retry can only help.`}
        </p>
        {/* Reviewing is as useful as retrying — the answers are still there to look through. */}
        <div className="grammar-actions">
          <button
            type="button"
            className="grammar-btn ghost"
            onClick={() => {
              setPage(1)
              setView('run')
            }}
          >
            <FontAwesomeIcon icon="magnifying-glass" />
            Review your answers
          </button>
          <button type="button" className="grammar-btn" onClick={retry}>
            <FontAwesomeIcon icon="rotate-left" />
            Try again
          </button>
        </div>
      </div>
    )
  }

  const fontSize = current ? optionFontSize(current.options.map((o) => o.label)) : undefined

  return (
    <div className="minigame">
      {/* One dot per question, spread across the full width. The current one scales up — a
          transform, so emphasising it can't push the row onto a second line. */}
      <div className="game-dots">
        {prepared.map((p, k) => (
          <span
            key={p.item.id}
            className={`game-dot${answers[k] != null ? ' answered' : ''}${k === i ? ' current' : ''}`}
          />
        ))}
      </div>

      {/* Keyed on the page so each card animates in fresh, from whichever side we came. */}
      <div key={page} className={`game-slide ${dir}`}>
        {onIntro ? (
          // Framing as its own slide, so it's read once and then out of the way rather than sitting
          // above every question.
          <div className="game-intro">
            <FontAwesomeIcon icon="circle-question" className="game-intro-icon" />
            <p className="game-intro-text">{topic.minigame.intro}</p>
            <p className="game-intro-hint">Press → or the chevron to begin.</p>
          </div>
        ) : (
          <>
            {/* The verb sits in the frame in dictionary form, dimmed and bracketed: it's the slot to
                fill. Either word can be held for its meaning, which lands in the strip below. */}
            <div className="game-prompt">
              <span className="game-frame">
                <HoldWord
                  label={`Meaning of ${current.cue.word}`}
                  onHold={() => setRevealed(`${current.cue.word}  ·  ${current.cue.meaning}`)}
                  onRelease={() => setRevealed(null)}
                >
                  <Furigana surface={current.cue.word} reading={current.cue.reading} className="game-cue" />
                </HoldWord>
                <span className="game-slot">
                  <span className="game-bracket">（</span>
                  <HoldWord
                    label={`Meaning of ${current.item.form}`}
                    onHold={() => setRevealed(`${current.item.form}  ·  ${current.item.meaning}`)}
                    onRelease={() => setRevealed(null)}
                  >
                    <Furigana
                      surface={current.item.form}
                      reading={current.item.reading}
                      className="game-slot-word"
                    />
                  </HoldWord>
                  <span className="game-bracket">）</span>
                </span>
              </span>
            </div>

            <div className="game-options">
              {current.options.map((o, k) => {
                const revealedAnswer = picked != null
                const state = !revealedAnswer ? 'idle' : o.correct ? 'correct' : picked === k ? 'wrong' : 'idle'
                return (
                  <button
                    key={o.label}
                    type="button"
                    className={`game-opt ${state}`}
                    disabled={revealedAnswer}
                    onClick={() => choose(k)}
                  >
                    {/* Mirrored empty slot: keeps the label centred once the icon slot fills. */}
                    <span className="game-opt-icon" />
                    <span className="game-opt-label" style={{ fontSize }}>
                      {o.label}
                    </span>
                    <span className="game-opt-icon">
                      {state === 'correct' && <FontAwesomeIcon icon="circle-check" />}
                      {state === 'wrong' && <FontAwesomeIcon icon="circle-xmark" />}
                    </span>
                  </button>
                )
              })}
            </div>

            <RevealStrip text={revealed} hint="Hold a word above to reveal its meaning." />
          </>
        )}
      </div>

      <div className="game-pager">
        <button
          type="button"
          className="pager-btn"
          onClick={goPrev}
          disabled={!canGoPrev}
          aria-label="Previous question"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <button
          type="button"
          className="pager-btn"
          onClick={goNext}
          disabled={!canGoNext}
          aria-label="Next question"
        >
          <FontAwesomeIcon icon="chevron-right" />
        </button>
      </div>

      {/* Finishing is always an explicit act — nothing here ends the run on your behalf. Once the
          attempt is recorded this button becomes the way back to the score. */}
      {remaining === 0 && (
        <div className="grammar-actions">
          <button type="button" className="grammar-btn" onClick={finish}>
            <FontAwesomeIcon icon={recorded.current ? 'chart-column' : 'check'} />
            {recorded.current ? 'Back to your score' : 'See your score'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Press-and-hold (mouse or touch) to push this word's gloss into the reveal strip. */
function HoldWord({
  label,
  onHold,
  onRelease,
  children,
}: {
  label: string
  onHold: () => void
  onRelease: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="hold-word"
      aria-label={label}
      onMouseDown={onHold}
      onMouseUp={onRelease}
      onMouseLeave={onRelease}
      onTouchStart={(e) => {
        e.preventDefault()
        onHold()
      }}
      onTouchEnd={(e) => {
        e.currentTarget.blur()
        onRelease()
      }}
      onTouchCancel={(e) => {
        e.currentTarget.blur()
        onRelease()
      }}
    >
      {children}
    </button>
  )
}
