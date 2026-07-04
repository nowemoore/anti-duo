import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { Progress } from '../../shared/types'
import { PRACTICE_ITERATIONS } from '../../shared/constants'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { introducedKanji } from '../lib/study'
import { awardDelta, pickTarget } from '../lib/practice'
import { recordTaskResult } from '../lib/stats'
import { LEVEL_FLOOR } from '../../shared/constants'
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

const round1 = (n: number): number => Math.round(n * 10) / 10

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
  // Lowest level each kanji reached this session — so a dip shows even if it later recovered.
  const minLevelRef = useRef<Record<number, number>>({ ...startLevelsRef.current })
  const prevTargetRef = useRef<number | null>(null)

  const [iteration, setIteration] = useState(0)
  const [current, setCurrent] = useState<Current | null>(null)
  const [done, setDone] = useState(false)

  const makeTask = useCallback((): Current | null => {
    const synthetic: Progress = { ...progress, kanji: workingRef.current }
    const targetIdx = pickTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (targetIdx == null) return null
    const studySet = Object.keys(workingRef.current).map(Number)
    const task = generateAnyTask(index, targetIdx, { studySet })
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
      minLevelRef.current[targetIdx] = Math.min(minLevelRef.current[targetIdx] ?? next, next)
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
        minLevels={minLevelRef.current}
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
  minLevels: Record<number, number>
  index: ReturnType<typeof useContent>
  onExit: () => void
}

function Summary({ working, startLevels, minLevels, index, onExit }: SummaryProps) {
  const changes = Object.entries(working).map(([idx, v]) => ({
    idx: Number(idx),
    char: index.byIdx.get(Number(idx))?.char ?? '?',
    from: startLevels[Number(idx)] ?? v.lvl,
    to: v.lvl,
    min: minLevels[Number(idx)] ?? startLevels[Number(idx)] ?? v.lvl,
  }))
  // Clean wins: improved and never dipped. Missed: dropped at some point (even if recovered).
  const gained = changes
    .filter((g) => g.to > g.from && g.min >= g.from)
    .sort((a, b) => b.to - b.from - (a.to - a.from))
  const dipped = changes
    .filter((g) => g.min < g.from)
    .sort((a, b) => a.to - a.from - (b.to - b.from))

  return (
    <section className="panel summary">
      <h2>
        <Bilingual ja="練習完了" en="Practice complete" />
      </h2>

      <div className="level-columns">
        <div className="level-col">
          <h3 className="level-head up">
            <FontAwesomeIcon icon="arrow-up" />
          </h3>
          {gained.length > 0 ? (
            <ul className="gain-list">
              {gained.map((g) => (
                <li key={g.idx}>
                  <span className="gain-char">{g.char}</span>
                  <span className="gain-delta">
                    {round1(g.from)} → {round1(g.to)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="none">—</p>
          )}
        </div>

        <div className="level-col">
          <h3 className="level-head down">
            <FontAwesomeIcon icon="arrow-down" />
          </h3>
          {dipped.length > 0 ? (
            <ul className="gain-list">
              {dipped.map((g) => (
                <li key={g.idx} className="lost">
                  <span className="gain-char">{g.char}</span>
                  <span className="gain-delta down">
                    {round1(g.from)} → {round1(g.to)}
                    {g.min < g.to ? ` ↓${round1(g.min)}` : ''}
                    {g.to < 1 ? ' · 再学習 (re-teach)' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="none">—</p>
          )}
        </div>
      </div>

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
