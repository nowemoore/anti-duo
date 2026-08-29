import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { KanaWord, Progress } from '../../shared/types'
import { PRACTICE_ITERATIONS } from '../../shared/constants'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { introducedUnits, isForgottenLevel } from '../lib/study'
import { awardDelta, levelDeltaFor, markSeen, pickMixedTarget } from '../lib/practice'
import { generateKanaTask, scoreKanaAnswer, type KanaTask } from '../lib/kanaTasks'
import { KanaTaskView } from './tasks/KanaTaskView'
import { recordTaskResult, recordWordResult } from '../lib/stats'
import { INTRODUCED_LEVEL, LEVEL_FLOOR } from '../../shared/constants'
import { generateAnyTask, testedWordKey, type Task } from '../lib/tasks'
import { useDrawableWord } from '../lib/useDrawableWord'
import { TaskRunner } from './tasks/TaskRunner'
import { Bilingual } from './Bilingual'
import { useAuth } from '../context/AuthContext'
import { describeAnswer, saveAnswer } from '../lib/answers'
import { saveDrawing } from '../lib/drawings'
import type { AnswerDetail } from './tasks/types'

interface Props {
  onExit: () => void
}

/**
 * The question on screen, and what it is about.
 *
 * A kanji question carries the unit's idx (its level is what moves); a kana one carries the word
 * itself, because a kana word has no unit and its progress lives in its own streak. Everything that
 * branches on the difference does so through this.
 */
type Current =
  /** `random`: the target came from the uniform exploration slice rather than by level weight — the
   *  only rows whose review gap the scheduler didn't choose, and so the only ones retention can
   *  honestly be fitted on. */
  | { kind: 'unit'; task: Task; targetIdx: number; random: boolean }
  | { kind: 'kana'; task: KanaTask; word: KanaWord }

type Levels = Record<number, { lvl: number }>

/**
 * Bar length in [0, 1] for a move, relative to the session's biggest move. A √ curve boosts smaller
 * moves so they read at a glance (the raw ratio makes them nearly invisible), plus a small floor so
 * any real move shows. 1 = fills the half-track.
 */
function barFraction(delta: number, maxAbs: number): number {
  if (maxAbs === 0) return 0
  return Math.max(0.14, Math.sqrt(Math.abs(delta) / maxAbs))
}

/** Runs PRACTICE_ITERATIONS tasks, evening kanji levels and persisting each correct answer. */
export function PracticeSession({ onExit }: Props) {
  const index = useContent()
  const { progress, update } = useProgress()
  // Gate on the recognizer: passing this is what enables 'draw' generation at all, so a draw task
  // is only ever produced for a word the canvas can actually grade.
  const canDrawWord = useDrawableWord()
  const { session } = useAuth()
  const userId = session?.user?.id
  /** When the question on screen appeared, for the answer log's latency. */
  const shownAtRef = useRef(Date.now())

  // Working level copy, seeded once from the introduced set.
  const workingRef = useRef<Levels>(
    Object.fromEntries(
      introducedUnits(index, progress).map((k) => [k.idx, { lvl: progress.units[k.idx]?.lvl ?? 1 }]),
    ),
  )
  const startLevelsRef = useRef<Record<number, number>>(
    Object.fromEntries(Object.entries(workingRef.current).map(([i, v]) => [Number(i), v.lvl])),
  )
  const prevTargetRef = useRef<number | null>(null)

  const [iteration, setIteration] = useState(0)
  const [current, setCurrent] = useState<Current | null>(null)
  const [done, setDone] = useState(false)

  const makeTask = useCallback((): Current | null => {
    const synthetic: Progress = { ...progress, units: workingRef.current }
    const pick = pickMixedTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (pick == null) return null
    if (pick.kind === 'kana') {
      const task = generateKanaTask(index, pick.word.idx)
      return task ? { kind: 'kana', task, word: pick.word } : null
    }
    const targetIdx = pick.idx
    const studySet = Object.keys(workingRef.current).map(Number)
    const task = generateAnyTask(index, targetIdx, {
      studySet,
      taskWeights: progress.settings.taskWeights,
      // Without this, staged release is a no-op here and the web app would ask about words the
      // learner hasn't been shown yet.
      levelOf: (idx) => workingRef.current[idx]?.lvl ?? 0,
      canDraw: canDrawWord,
    })
    return task ? { kind: 'unit', task, targetIdx, random: pick.random } : null
  }, [index, progress, canDrawWord])

  // First task.
  useEffect(() => {
    const first = makeTask()
    if (first) setCurrent(first)
    else setDone(true)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * One row per answered question, for distractor quality, per-skill accuracy and retention.
   *
   * `Progress` keeps only running totals, which cannot answer "which distractor did they pick" or
   * "what fraction is still correct after three weeks" — those need the individual events. Signed
   * out there is nowhere to put them, so nothing is written. Fire-and-forget either way: a logging
   * failure must never disrupt practice.
   */
  const logAnswer = (
    args: {
      unitIdx: number | null
      taskKind: string
      correct: boolean
      score: number
      sentenceId: string | null
      lvlBefore: number | null
      wordStreakBefore: number | null
      prevSeenAt: string | null
      randomPick: boolean
      drawingId: string | null
    },
    detail?: AnswerDetail,
  ) => {
    if (!userId) return
    void saveAnswer({
      userId,
      lang: index.lang.id,
      picked: describeAnswer(detail?.picked),
      latencyMs: Date.now() - shownAtRef.current,
      ...args,
    }).catch(() => {})
  }

  const handleResult = (delta: number, detail?: AnswerDetail) => {
    if (!current) return

    /*
     * A kana answer touches none of the level machinery: no unit, no `lvl`, nothing to even out.
     * It moves the word's own run, the runs of the characters it is spelled from, and marks the word
     * met — see scoreKanaAnswer — plus the same per-task tally every question feeds.
     */
    if (current.kind === 'kana') {
      const { task, word } = current
      update((p) =>
        recordTaskResult(scoreKanaAnswer(p, word, delta > 0, new Date().toISOString()), task.kind, delta),
      )
      logAnswer(
        {
          unitIdx: null,
          taskKind: task.kind,
          correct: delta > 0,
          score: delta,
          sentenceId: task.sentence?.id ?? null,
          // No unit, so no level and no recency: a kana word's strength lives in its own streak.
          lvlBefore: null,
          wordStreakBefore: progress.words?.[word.word] ?? 0,
          prevSeenAt: null,
          randomPick: false,
          drawingId: null,
        },
        detail,
      )
      advance()
      return
    }

    const { task, targetIdx } = current

    // Scale the level change by this task type's reward/penalty knob, damped while the kanji is still
    // warming up so a new one can't be un-learned by a single miss; Stats accuracy uses raw `delta`.
    const cur = workingRef.current[targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const levelDelta = levelDeltaFor(task.kind, delta, cur)
    if (levelDelta !== 0) {
      const next = Math.max(LEVEL_FLOOR, cur + levelDelta)
      workingRef.current = { ...workingRef.current, [targetIdx]: { lvl: next } }
    }
    // Record the attempt for every answer (even a net-zero which-words); the level delta only moves
    // when nonzero, but the success tally always counts the attempt. Tasks that test one specific
    // word also move that word's "known" run (which-words tests four at once, so it doesn't count).
    // Checked against the curated vocabulary: a cloze can focus an inflection (食べた), which
    // shouldn't be tracked separately from its dictionary form.
    // Keyed by surface *and* reading where a form has more than one: missing 木/き must not walk
    // 木/もく backwards, and getting もく right must not credit き.
    const word = testedWordKey(task, index)
    // Read before the update: these describe the state the question was answered *from*, which is
    // what retention has to be conditioned on.
    const lvlBefore = progress.units[targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const prevSeenAt = progress.units[targetIdx]?.lastSeenAt ?? null
    const wordStreakBefore = word ? (progress.words?.[word] ?? 0) : null
    update((p) => {
      let next = levelDelta !== 0 ? awardDelta(p, targetIdx, levelDelta) : p
      // Every answered question stamps recency, including the ones worth no level change.
      next = markSeen(next, targetIdx, new Date().toISOString())
      next = recordTaskResult(next, task.kind, delta)
      return word ? recordWordResult(next, word, delta > 0) : next
    })
    prevTargetRef.current = targetIdx

    const row = {
      unitIdx: targetIdx,
      taskKind: task.kind,
      correct: delta > 0,
      score: delta,
      sentenceId: 'sentence' in task ? task.sentence.id : null,
      lvlBefore,
      wordStreakBefore,
      prevSeenAt,
      randomPick: current.random,
    }
    /*
     * A drawing is saved to its own table first and linked from the answer row, so the strokes and
     * the verdict on them stay one record. Practice only ever offers recognizer-graded words —
     * tracing lives in the write review — hence mode 'recognized'.
     */
    const strokes = detail?.strokes
    if (task.kind === 'draw' && userId && Array.isArray(strokes) && strokes.length) {
      saveDrawing({
        userId,
        lang: index.lang.id,
        unitIdx: targetIdx,
        word: task.word,
        strokes,
        correct: delta > 0,
        mode: 'recognized',
      })
        .then((drawingId) => logAnswer({ ...row, drawingId }, detail))
        .catch(() => logAnswer({ ...row, drawingId: null }, detail))
    } else {
      logAnswer({ ...row, drawingId: null }, detail)
    }

    advance()
  }

  /** Step to the next question, or end the run. Shared by both answer paths. */
  function advance() {
    shownAtRef.current = Date.now()
    const nextIteration = iteration + 1
    setIteration(nextIteration)
    if (nextIteration >= PRACTICE_ITERATIONS) {
      setCurrent(null)
      setDone(true)
      return
    }
    const next = makeTask()
    if (next) setCurrent(next)
    else setDone(true)
  }

  if (done) {
    return (
      <Summary
        working={workingRef.current}
        startLevels={startLevelsRef.current}
        index={index}
        onExit={onExit}
      />
    )
  }

  if (!current) return <section className="panel">Loading…</section>

  return (
    <section className="panel practice">
      <div className="practice-head">
        <button
          type="button"
          className="practice-back"
          onClick={onExit}
          aria-label="Back to study home"
        >
          <FontAwesomeIcon icon="chevron-left" />
        </button>
        <Bilingual
          className="step"
          ja={`問題 ${iteration + 1} / ${PRACTICE_ITERATIONS}`}
          en={`Question ${iteration + 1} / ${PRACTICE_ITERATIONS}`}
        />
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${(iteration / PRACTICE_ITERATIONS) * 100}%` }} />
      </div>

      <div className="task-wrap" key={iteration}>
        {current.kind === 'kana' ? (
          <KanaTaskView task={current.task} onResult={handleResult} />
        ) : (
          <TaskRunner task={current.task} onResult={handleResult} />
        )}
      </div>
    </section>
  )
}

interface SummaryProps {
  working: Levels
  startLevels: Record<number, number>
  index: ReturnType<typeof useContent>
  onExit: () => void
}

function Summary({ working, startLevels, index, onExit }: SummaryProps) {
  // How far each touched kanji moved this session (net). Direction sets the side + colour of the
  // bar; magnitude sets its length. No raw levels/points shown — just the shape of the change.
  const moves = Object.entries(working)
    .map(([idx, v]) => {
      const i = Number(idx)
      return {
        idx: i,
        form: index.byIdx.get(i)?.form ?? '?',
        delta: v.lvl - (startLevels[i] ?? v.lvl),
        reteach: isForgottenLevel(v.lvl), // lapsed to the floor → goes back into Learn
      }
    })
    .filter((m) => m.delta !== 0)
    .sort((a, b) => b.delta - a.delta) // biggest gains on top, biggest slips at the bottom

  // Scale bars to the session's largest move, so the row that moved most fills the half-track.
  const maxAbs = moves.reduce((m, x) => Math.max(m, Math.abs(x.delta)), 0)

  return (
    <section className="panel summary">
      <h2>
        <Bilingual ja="進捗概要" en="Progress overview" />
      </h2>

      {moves.length === 0 ? (
        <p className="none">No changes this round.</p>
      ) : (
        <ul className="move-list">
          {moves.map((m) => {
            const up = m.delta > 0
            const endPct = barFraction(m.delta, maxAbs) * 44 // leave room past the bar for the number
            return (
              <li key={m.idx} className="move-row">
                <span className="move-char">{m.form}</span>
                <div className="move-track">
                  <span className="move-axis" />
                  <span className={`move-bar ${up ? 'up' : 'down'}`} style={{ width: `${endPct}%` }} />
                  <span
                    className={`move-num ${up ? 'up' : 'down'}`}
                    style={
                      up
                        ? { left: `calc(50% + ${endPct}% + 0.3rem)` }
                        : { right: `calc(50% + ${endPct}% + 0.3rem)` }
                    }
                  >
                    {up ? '+' : ''}
                    {m.delta.toFixed(1)}
                  </span>
                </div>
                {m.reteach && <span className="move-tag">back to learning</span>}
              </li>
            )
          })}
        </ul>
      )}

      <div className="actions">
        <button type="button" className="pill-btn" onClick={onExit}>
          <span className="icon-circle">
            <FontAwesomeIcon icon="check" />
          </span>
          <Bilingual ja="完了" en="Done" />
        </button>
      </div>
    </section>
  )
}
