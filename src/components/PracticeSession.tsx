import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Progress } from '../../shared/types'
import { PRACTICE_ITERATIONS } from '../../shared/constants'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { introducedKanji } from '../lib/study'
import { awardDelta, pickTarget } from '../lib/practice'
import { recordTaskResult } from '../lib/stats'
import { INTRODUCED_LEVEL, LEVEL_FLOOR } from '../../shared/constants'
import { generateAnyTask, TASK_TUNING, type Task } from '../lib/tasks'
import { TaskRunner } from './tasks/TaskRunner'
import { Bilingual } from './Bilingual'

interface Props {
  onExit: () => void
}

interface Current {
  task: Task
  targetIdx: number
}

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

  // Working level copy, seeded once from the introduced set.
  const workingRef = useRef<Levels>(
    Object.fromEntries(
      introducedKanji(index, progress).map((k) => [k.idx, { lvl: progress.kanji[k.idx]?.lvl ?? 1 }]),
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
    const synthetic: Progress = { ...progress, kanji: workingRef.current }
    const targetIdx = pickTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (targetIdx == null) return null
    const studySet = Object.keys(workingRef.current).map(Number)
    const task = generateAnyTask(index, targetIdx, {
      studySet,
      taskWeights: progress.settings.taskWeights,
    })
    return task ? { task, targetIdx } : null
  }, [index, progress])

  // First task.
  useEffect(() => {
    const first = makeTask()
    if (first) setCurrent(first)
    else setDone(true)
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResult = (delta: number) => {
    if (!current) return
    const { task, targetIdx } = current

    // Scale the level change by this task type's `points` knob; Stats accuracy still uses raw `delta`.
    const levelDelta = delta * TASK_TUNING[task.kind].points
    if (levelDelta !== 0) {
      const cur = workingRef.current[targetIdx]?.lvl ?? 1
      const next = Math.max(LEVEL_FLOOR, cur + levelDelta)
      workingRef.current = { ...workingRef.current, [targetIdx]: { lvl: next } }
    }
    // Record the attempt for every answer (even a net-zero which-words); the level delta only moves
    // when nonzero, but the success tally always counts the attempt.
    update((p) =>
      recordTaskResult(levelDelta !== 0 ? awardDelta(p, targetIdx, levelDelta) : p, task.kind, delta),
    )
    prevTargetRef.current = targetIdx

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
        <TaskRunner task={current.task} onResult={handleResult} />
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
        char: index.byIdx.get(i)?.char ?? '?',
        delta: v.lvl - (startLevels[i] ?? v.lvl),
        reteach: v.lvl < INTRODUCED_LEVEL, // fell below intro → goes back into Learn
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
                <span className="move-char">{m.char}</span>
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
