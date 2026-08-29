import { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, View, Text, ScrollView, StyleSheet } from 'react-native'
import { PagerChevron } from './PagerChevron'
import { TapScale } from './TapScale'
import { TaskChip } from './TaskChip'
import type { Progress } from '@shared/types'
import { INTRODUCED_LEVEL, LEVEL_FLOOR, PRACTICE_ITERATIONS } from '@shared/constants'
import { introducedUnits, isForgottenLevel } from '@lib/study'
import { awardDelta, levelDeltaFor, markSeen, pickMixedTarget } from '@lib/practice'
import { generateKanaTask, scoreKanaAnswer } from '@lib/kanaTasks'
import { amendTaskResult, recordTaskResult, recordWordResult, restoreWordStreak } from '@lib/stats'
import { generateAnyTask, testedWordKey, WHICH_WORDS_OPTIONS, WHICH_WORDS_POINT, type Task } from '@lib/tasks'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useLanguage } from '../context/LanguageContext'
import { useScreenHeader } from '../context/HeaderContext'
import { Bilingual } from './Bilingual'
import { Icon } from './Icon'
import { FadeView } from './FadeView'
import { RevealContextProvider, RevealStrip } from './RevealStrip'
import { TaskRunner } from './tasks/TaskRunner'
import { getTaskUI } from './tasks/registry'
import type { QA } from './tasks/types'
import { useDrawableWord } from '../hooks/useDrawableWord'
import { useAuth } from '../context/AuthContext'
import { saveDrawing, overrideDrawing } from '../lib/drawings'
import { describeAnswer, saveAnswer } from '../lib/answers'
import type { DrawStroke } from '../lang/types'
import { btnLabel, btnLabelQuiet, btnPrimary, btnSecondary, edge, fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'
import { fadeColor, useVerdictFade } from '../hooks/verdictFade'

type Levels = Record<number, { lvl: number }>

/** Bar length in [0,1] relative to the session's biggest move (√ curve + floor so small moves show). */
function barFraction(delta: number, maxAbs: number): number {
  if (maxAbs === 0) return 0
  return Math.max(0.14, Math.sqrt(Math.abs(delta) / maxAbs))
}

const WHICH_WORDS_MAX = WHICH_WORDS_OPTIONS * WHICH_WORDS_POINT

/** Whether a revealed question counts as correct (perfect for which-words). */
function isCorrect(qa: QA): boolean {
  if (qa.task.kind === 'which-words') return qa.score >= WHICH_WORDS_MAX
  return qa.score > 0
}

export function PracticeSession({
  onExit,
  onRestart,
}: {
  onExit: () => void
  /** Start a fresh round. Remounts the session, so targets are re-picked from updated progress. */
  onRestart?: () => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const index = useContent()
  const { progress, update } = useProgress()
  const canDrawWord = useDrawableWord()
  const pack = useLanguage()
  const { session } = useAuth()
  const userId = session?.user?.id
  // Supabase row id of each saved draw answer, keyed by question position — so an override can update it.
  const drawingIdRef = useRef<Record<number, string>>({})

  const workingRef = useRef<Levels>(
    Object.fromEntries(
      introducedUnits(index, progress).map((k) => [k.idx, { lvl: progress.units[k.idx]?.lvl ?? 1 }]),
    ),
  )
  const startLevelsRef = useRef<Record<number, number>>(
    Object.fromEntries(Object.entries(workingRef.current).map(([i, v]) => [Number(i), v.lvl])),
  )
  const prevTargetRef = useRef<number | null>(null)

  const makeQA = useCallback((): QA | null => {
    const synthetic: Progress = { ...progress, units: workingRef.current }
    const pick = pickMixedTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (pick == null) return null

    // A kana word: no unit, so no study set and no staged release — just the word and a question
    // about it. `targetIdx` is -1 because there is nothing for it to point at; `kanaWord` is what
    // the rest of the session branches on.
    if (pick.kind === 'kana') {
      const task = generateKanaTask(index, pick.word.idx)
      if (!task) return null
      const ui = getTaskUI(task.kind, pack)
      return {
        task,
        kanaWord: pick.word,
        targetIdx: -1,
        answer: ui ? ui.emptyAnswer() : null,
        phase: 'first',
        score: 0,
        recorded: false,
        shownAt: Date.now(),
      }
    }

    const targetIdx = pick.idx
    const studySet = Object.keys(workingRef.current).map(Number)
    const task = generateAnyTask(index, targetIdx, {
      studySet,
      taskWeights: progress.settings.taskWeights,
      tasks: pack.tasks, // the active language's task inventory
      canDraw: canDrawWord, // enables 'draw' (mobile-only) for all-learned words
      // Staged word release: a unit's later word-batches unlock as its level climbs (Arabic).
      levelOf: (idx) => workingRef.current[idx]?.lvl ?? 0,
    })
    if (!task) return null
    const ui = getTaskUI(task.kind, pack)
    return {
      task,
      targetIdx,
      answer: ui ? ui.emptyAnswer() : null,
      phase: 'first',
      score: 0,
      recorded: false,
      randomPick: pick.random,
      shownAt: Date.now(),
    }
  }, [index, progress, canDrawWord, pack])

  const [history, setHistory] = useState<QA[]>(() => {
    const first = makeQA()
    return first ? [first] : []
  })
  const [pos, setPos] = useState(0)
  const [done, setDone] = useState(false)
  const [reveal, setReveal] = useState<string | null>(null)
  const revealApi = useMemo(() => ({ show: (t: string) => setReveal(t), hide: () => setReveal(null) }), [])

  const qa = history[pos]
  const total = PRACTICE_ITERATIONS

  // Step label + progress bar go in the app top bar; the summary keeps only the back button.
  const qHead = pack.ui.questionHeader(pos + 1, total)
  useScreenHeader(
    done || !qa ? undefined : { ja: qHead.native, en: qHead.en },
    done || !qa ? undefined : { current: pos + 1, total },
  )

  /**
   * Apply a revealed question's score to the working levels + persisted progress (once).
   * Returns the level change actually applied, so the caller can store it on the QA for `override`.
   */
  const record = (item: QA): { levelDelta: number; prevWordStreak: number } => {
    /*
     * A kana answer touches none of the level machinery: there is no unit to move, nothing to damp
     * and nothing to even out. It moves the characters' runs, the word's own run and marks the word
     * met (see scoreKanaAnswer), plus the per-task tally every question feeds. The zeroes it returns
     * mean an override would be a no-op — which is right: none of these tasks offers one.
     */
    if (item.kanaWord) {
      const kanaWord = item.kanaWord
      const correct = isCorrect(item)
      update((p) =>
        recordTaskResult(scoreKanaAnswer(p, kanaWord, correct, new Date().toISOString()), item.task.kind, item.score),
      )
      if (userId) {
        void saveAnswer({
          userId,
          lang: pack.id,
          unitIdx: null,
          taskKind: item.task.kind,
          correct,
          score: item.score,
          picked: describeAnswer(item.answer),
          sentenceId: 'sentence' in item.task ? (item.task.sentence?.id ?? null) : null,
          lvlBefore: null,
          wordStreakBefore: progress.words?.[kanaWord.word] ?? 0,
          prevSeenAt: null,
          latencyMs: item.shownAt ? Date.now() - item.shownAt : null,
          randomPick: item.randomPick ?? false,
          drawingId: null,
        }).catch(() => {})
      }
      return { levelDelta: 0, prevWordStreak: 0 }
    }

    /*
     * Past the branch above every question is a kanji one, but the union on `QA.task` can't be
     * narrowed by `item.kanaWord` — so it's stated once here rather than at each of the six uses.
     */
    const task = item.task as Task

    // Damped while the kanji is still warming up, so a new one can't be un-learned by one miss.
    const cur = workingRef.current[item.targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const levelDelta = levelDeltaFor(task.kind, item.score, cur)
    if (levelDelta !== 0) {
      const nextLvl = Math.max(LEVEL_FLOOR, cur + levelDelta)
      workingRef.current = { ...workingRef.current, [item.targetIdx]: { lvl: nextLvl } }
    }
    // Per-word "known" run, for the Stats card. Only tasks that test one specific word count —
    // which-words shows four at once, so a good score there isn't evidence about any one of them.
    // Sentence-derived words are checked against the curated vocabulary: a cloze can focus an
    // inflection (食べた) which shouldn't be tracked separately from its dictionary form.
    // Keyed by surface *and* reading where a form has more than one: missing 木/き must not walk
    // 木/もく backwards, and getting もく right must not credit き.
    const word = testedWordKey(task, index)
    // Read before the update so an override can put it back exactly. Safe to read from the rendered
    // progress: exactly one answer is recorded per question, and each needs its own tap.
    const prevWordStreak = word ? (progress.words?.[word] ?? 0) : 0
    // Read before the update: these describe the state the question was answered *from*, which is
    // what retention has to be conditioned on.
    const lvlBefore = progress.units[item.targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const prevSeenAt = progress.units[item.targetIdx]?.lastSeenAt ?? null
    const answeredAt = new Date().toISOString()
    update((p) => {
      let next = levelDelta !== 0 ? awardDelta(p, item.targetIdx, levelDelta) : p
      // Every answered question stamps recency, including the ones worth no level change.
      next = markSeen(next, item.targetIdx, answeredAt)
      next = recordTaskResult(next, task.kind, item.score)
      return word ? recordWordResult(next, word, isCorrect(item)) : next
    })
    prevTargetRef.current = item.targetIdx

    // One row per answered question, for distractor quality, per-skill accuracy and retention.
    // Fire-and-forget, like the drawing below: a logging failure must never disrupt practice.
    const logAnswer = (drawingId: string | null) => {
      if (!userId) return
      void saveAnswer({
        userId,
        lang: pack.id,
        unitIdx: item.targetIdx,
        taskKind: task.kind,
        correct: isCorrect(item),
        score: item.score,
        picked: describeAnswer(item.answer),
        sentenceId: 'sentence' in task ? task.sentence.id : null,
        lvlBefore,
        wordStreakBefore: word ? prevWordStreak : null,
        prevSeenAt,
        latencyMs: item.shownAt ? Date.now() - item.shownAt : null,
        randomPick: item.randomPick ?? false,
        drawingId,
      }).catch(() => {})
    }

    // Persist the drawing (with the recognizer's verdict) to Supabase — a history. Fire-and-forget:
    // a save failure must never disrupt practice. A later override updates the row (via its id).
    // The answer row is written after it, so a draw answer can link to its strokes.
    const strokes = item.answer as DrawStroke[]
    if (task.kind === 'draw' && userId && Array.isArray(strokes) && strokes.length) {
      const at = pos
      const drawnWord = task.word
      // Practice only ever offers recognizer-graded words; tracing lives in the write review.
      saveDrawing({ userId, lang: pack.id, unitIdx: item.targetIdx, word: drawnWord, strokes, correct: item.score > 0, mode: 'recognized' })
        .then((id) => {
          if (id) drawingIdRef.current[at] = id
          logAnswer(id)
        })
        .catch(() => logAnswer(null))
    } else {
      logAnswer(null)
    }
    return { levelDelta, prevWordStreak }
  }

  const patch = (updated: QA) => setHistory((h) => h.map((x, k) => (k === pos ? updated : x)))

  /** Record, then patch once with the applied delta attached. */
  const commitAnswer = (updated: QA) => patch({ ...updated, ...record(updated) })

  const lockIn = () => {
    if (!qa || qa.phase === 'revealed') return
    const ui = getTaskUI(qa.task.kind, pack)
    if (!ui) return
    // Same pairing-by-kind as TaskRunner: the UI came from the task's own kind, so it grades it.
    const res = ui.resolve(qa.task as Task, qa.answer, qa.phase, pack)
    const answer = res.answer !== undefined ? res.answer : qa.answer
    if (res.phase === 'retry') {
      patch({ ...qa, answer, phase: 'retry' })
      return
    }
    commitAnswer({ ...qa, answer, phase: 'revealed', score: res.score, recorded: true })
  }

  const giveUp = () => {
    if (!qa || qa.phase === 'revealed') return
    commitAnswer({ ...qa, phase: 'revealed', score: -1, recorded: true })
  }

  const setAnswer = (a: unknown) =>
    setHistory((h) => h.map((x, k) => (k === pos && x.phase !== 'revealed' ? { ...x, answer: a } : x)))

  const prev = () => {
    setReveal(null)
    setPos((p) => Math.max(0, p - 1))
  }
  const next = () => {
    setReveal(null)
    if (pos < history.length - 1) {
      setPos(pos + 1)
      return
    }
    if (!qa || qa.phase !== 'revealed') return
    if (history.length >= total) {
      setDone(true)
      return
    }
    const nq = makeQA()
    if (!nq) {
      setDone(true)
      return
    }
    setHistory((h) => [...h, nq])
    setPos(history.length)
  }

  /**
   * A task's verdict override (draw: "I think I got this one right" on a miss, or "…wrong" on a hit —
   * the recognizer can misread either way). The button always asserts the opposite of what the
   * recognizer said, so the learner's verdict is unambiguous.
   *
   * The answer is **re-scored** as that verdict rather than cancelled: level, word run and the
   * task's success rate all end up where they would have been had the recognizer got it right the
   * first time. The recognizer has no patterns at all for a chunk of the curriculum and misreads
   * plenty of the rest, so treating a dispute as "no result" would let its failures cap real progress.
   */
  const override = () => {
    if (!qa || qa.phase !== 'revealed' || qa.overridden || qa.kanaWord) return
    // Kanji-only, as the guard above now says outright: no kana task offers an override link.
    const task = qa.task as Task
    const recognizerCorrect = isCorrect(qa) // the verdict being disputed (before we re-score)
    const learnerCorrect = !recognizerCorrect
    const newScore = learnerCorrect ? 1 : -1

    // Re-derive the delta from the level *before* this answer touched it, so warm-up damping is
    // applied against the same level the original verdict saw.
    const applied = qa.appliedDelta ?? 0
    const cur = workingRef.current[qa.targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const newDelta = levelDeltaFor(task.kind, newScore, cur - applied)
    const correction = newDelta - applied
    workingRef.current = { ...workingRef.current, [qa.targetIdx]: { lvl: Math.max(LEVEL_FLOOR, cur + correction) } }
    patch({ ...qa, score: newScore, overridden: true, appliedDelta: newDelta })

    // Same key as when it was first recorded, or the rewind would restore the wrong run.
    const word = testedWordKey(task, index)
    update((p) => {
      let next = correction !== 0 ? awardDelta(p, qa.targetIdx, correction) : p
      // Swap the points the original verdict earned for the learner's, without a second attempt.
      next = amendTaskResult(next, task.kind, qa.score, newScore)
      // Rewind the run to before the disputed answer, then apply the verdict the learner gave.
      if (word) next = recordWordResult(restoreWordStreak(next, word, qa.prevWordStreak ?? 0), word, learnerCorrect)
      return next
    })
    const id = drawingIdRef.current[pos]
    if (id) void overrideDrawing(id, recognizerCorrect).catch(() => {})
    next()
  }

  /*
   * Above the early return: hooks must run in the same order every render, and the Summary path
   * below bails out before the card is built. Reads `qa` defensively for that reason.
   *
   * The verdict lands on the whole card, not just a pill — eased in, because a card that changes
   * colour instantly reads as an alarm rather than an answer.
   */
  // Overriding re-scores the answer rather than voiding it, so a corrected verdict colours the
  // card like any other. It used to fall back to neutral, which read as "nothing happened".
  const judged = qa?.phase === 'revealed'
  const verdict = useVerdictFade(judged)

  /*
   * The card only scrolls when its content genuinely doesn't fit.
   *
   * A plain ScrollView bounces on iOS even when everything fits, which makes a card that isn't
   * overflowing feel like it is. Leaving it permanently off isn't safe either — a long sentence with
   * four options can exceed a short screen, and that content would just be unreachable. So it's
   * measured, the same way the Learn card does it.
   */
  const [overflows, setOverflows] = useState(false)
  const viewportH = useRef(0)
  const contentH = useRef(0)
  const syncScrollable = () => setOverflows(contentH.current - viewportH.current > 1)

  if (done || !qa) {
    return (
      <Summary
        working={workingRef.current}
        startLevels={startLevelsRef.current}
        index={index}
        onExit={onExit}
        onRestart={onRestart}
      />
    )
  }

  const ui = getTaskUI(qa.task.kind, pack)
  const revealed = qa.phase === 'revealed'
  const correct = revealed && isCorrect(qa)
  const overridden = revealed && !!qa.overridden
  const pagerLock = ui?.pagerLock !== false // type-word renders its own inline lock
  const canLock = !revealed && !!ui && ui.hasAnswer(qa.answer)
  const canPrev = pos > 0
  const canNext = pos < history.length - 1 || revealed

  const verdictTint = judged ? (correct ? colors.correctSoft : colors.incorrectSoft) : colors.panel
  const verdictEdge = judged ? (correct ? colors.correct : colors.incorrect) : colors.border

  return (
    <>
    <Animated.View
      style={[
        styles.panel,
        {
          backgroundColor: fadeColor(verdict, colors.panel, verdictTint),
          borderColor: fadeColor(verdict, colors.border, verdictEdge),
        },
      ]}
    >
      <RevealContextProvider value={revealApi}>
        {/* Outside the scroller: the chip labels the card, so it stays put while the task scrolls. */}
        <TaskChip kind={qa.task.kind} />
        <ScrollView
          style={styles.taskScroll}
          contentContainerStyle={styles.taskScrollContent}
          keyboardShouldPersistTaps="handled"
          // A task (draw) may disable scrolling outright to own its gestures; otherwise it turns on
          // only once the content has been measured as taller than the card.
          scrollEnabled={ui?.scrollable !== false && overflows}
          bounces={false}
          overScrollMode="never"
          onLayout={(e) => {
            viewportH.current = e.nativeEvent.layout.height
            syncScrollable()
          }}
          onContentSizeChange={(_w, h) => {
            contentH.current = h
            syncScrollable()
          }}
        >
          {/*
            key on pos fades each question in and gives a clean mount; back-nav replays answers.

            A task that owns its vertical space (draw) needs the wrapper to stretch, or its flexing
            canvas has no bounded parent to fill and collapses to its minimum. The scrolling tasks
            stay auto-height so the content container keeps centring them.
          */}
          <FadeView key={pos} style={ui?.scrollable === false ? styles.taskFill : undefined}>
            <TaskRunner qa={qa} setAnswer={setAnswer} onLock={lockIn} onGiveUp={giveUp} />
          </FadeView>
          {/*
            A task's verdict override (draw) sits right under the answer — either direction.

            The slot is reserved for the whole question, not just while the link is up: the scroll
            content is centred, so a link appearing at reveal used to lift the canvas by its height
            just as the learner looked at their strokes.
          */}
          {(ui?.overrideLabel || ui?.overrideWrongLabel) && (
            <View style={styles.keepSlot}>
              {ui?.overrideLabel && revealed && !correct && !overridden && (
                <TapScale style={styles.keepLink} onPress={override} hitSlop={8}>
                  <Text style={styles.keepText}>{ui.overrideLabel}</Text>
                </TapScale>
              )}
              {ui?.overrideWrongLabel && revealed && correct && !overridden && (
                <TapScale style={styles.keepLink} onPress={override} hitSlop={8}>
                  <Text style={styles.keepText}>{ui.overrideWrongLabel}</Text>
                </TapScale>
              )}
            </View>
          )}
        </ScrollView>
      </RevealContextProvider>

      <View style={styles.pager}>
        <PagerChevron dir="prev" onPress={prev} disabled={!canPrev} label="Previous question" />

        {revealed ? (
          <View style={[styles.verdict, correct ? styles.verdictCorrect : styles.verdictWrong]}>
            <Text style={[styles.verdictText, { color: correct ? colors.correct : colors.incorrect }]}>
              {correct ? 'Correct' : 'Incorrect'}
            </Text>
          </View>
        ) : pagerLock ? (
          <TapScale
            style={[styles.lockBtn, styles.lockActive, !canLock && styles.disabled]}
            onPress={lockIn}
            disabled={!canLock}
            accessibilityLabel="Lock in your answer"
          >
            <Icon name="lock" size={15} color={colors.onAccent} />
            {/* Dark ink on the accent: light ink measured 1.9:1 on this fill, dark is 6.3:1. */}
            <Text style={[styles.lockText, { color: colors.onAccent }]}>Lock in answer</Text>
          </TapScale>
        ) : (
          <View style={styles.lockSlot} />
        )}

        <PagerChevron dir="next" onPress={next} disabled={!canNext} label="Next question" />
      </View>
    </Animated.View>

    {/* Below the card and full-bleed: hold a word to see its reading/meaning. Tasks that own their
        space (draw) omit it. */}
    {ui?.revealHint && (
      <RevealStrip text={reveal} hint={ui.revealHint(qa.phase, pack)} />
    )}
    </>
  )
}

interface SummaryProps {
  working: Levels
  startLevels: Record<number, number>
  index: ReturnType<typeof useContent>
  onExit: () => void
  onRestart?: () => void
}

function Summary({ working, startLevels, index, onExit, onRestart }: SummaryProps) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { ui } = useLanguage()
  const moves = Object.entries(working)
    .map(([idx, v]) => {
      const i = Number(idx)
      return {
        idx: i,
        form: index.byIdx.get(i)?.form ?? '?',
        delta: v.lvl - (startLevels[i] ?? v.lvl),
        reteach: isForgottenLevel(v.lvl),
      }
    })
    .filter((m) => m.delta !== 0)
    .sort((a, b) => b.delta - a.delta)

  const maxAbs = moves.reduce((m, x) => Math.max(m, Math.abs(x.delta)), 0)

  return (
    <View style={styles.panel}>
      <View style={styles.summaryTitle}>
        <Bilingual native={ui.summaryTitle.native} en={ui.summaryTitle.en} large />
      </View>

      {moves.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.none}>No changes this round.</Text>
        </View>
      ) : (
        <>
          {moves.length > 6 && (
            <View style={styles.scrollHint}>
              <Text style={styles.scrollHintText}>scroll for all {moves.length}</Text>
              <Icon name="chevron-down" size={11} color={colors.muted} />
            </View>
          )}
          <ScrollView
            style={styles.moveScroll}
            contentContainerStyle={styles.moveList}
            showsVerticalScrollIndicator
            persistentScrollbar
          >
            {moves.map((m) => {
              const up = m.delta > 0
              const endPct = barFraction(m.delta, maxAbs) * 34
              const barWidth = `${endPct * 2}%` as const
            const color = up ? colors.correct : colors.incorrect
            const label = `${up ? '+' : ''}${m.delta.toFixed(1)}`
            return (
              <View key={m.idx} style={styles.moveCell}>
                <Text style={styles.moveChar}>{m.form}</Text>
                <View style={styles.track}>
                  <View style={[styles.half, styles.halfLeft]}>
                    {!up && (
                      <>
                        <Text style={[styles.num, { color, marginRight: 4 }]}>{label}</Text>
                        <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
                      </>
                    )}
                  </View>
                  <View style={styles.tick} />
                  <View style={[styles.half, styles.halfRight]}>
                    {up && (
                      <>
                        <View style={[styles.bar, { width: barWidth, backgroundColor: color }]} />
                        <Text style={[styles.num, { color, marginLeft: 4 }]}>{label}</Text>
                      </>
                    )}
                  </View>
                </View>
                  {m.reteach && <Text style={styles.tag}>back to learning</Text>}
                </View>
              )
            })}
          </ScrollView>
        </>
      )}

      {/* Carrying on is the likelier next step, so it takes the accent; the other is the quiet one. */}
      <View style={styles.summaryActions}>
        {/*
          A chevron that trails the label and points forward. It used to lead and point back, which
          made leaving the summary look like undoing it — but the vocabulary section is where you go
          *next*, to pick up what this round showed you were missing. It's a step on, not a retreat.
        */}
        <TapScale style={styles.backBtn} onPress={onExit}>
          <Text style={styles.backText} numberOfLines={1}>
            Learn extras
          </Text>
          <Icon name="chevron-right" size={12} color={colors.ink} />
        </TapScale>
        {onRestart && (
          <TapScale style={styles.doneBtn} onPress={onRestart}>
            {/* `onAccent`, like the label beside it — the two are one phrase, and the icon was
                rendering in the page's light ink against the accent fill the label sits on. */}
            <Icon name="rotate-left" size={12} color={colors.onAccent} />
            <Text style={styles.doneText} numberOfLines={1}>
              Keep practising
            </Text>
          </TapScale>
        )}
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: edge,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  taskScroll: { flex: 1 },
  taskFill: { flex: 1 },
  taskScrollContent: { flexGrow: 1, justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  // Bare glyphs, matching the system back chevron in the navigation bar: no circle, no fill,
  // no border. The 46pt box is the tap target, not a visible button.
  lockSlot: { flex: 1 },
  lockBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  lockActive: { backgroundColor: colors.accent },
  lockText: { fontFamily: fonts.semibold, fontSize: 14 },
  verdict: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  verdictCorrect: { backgroundColor: colors.correctSoft },
  verdictWrong: { backgroundColor: colors.incorrectSoft },
  verdictText: { fontFamily: fonts.semibold, fontSize: 14 },
  keepSlot: { height: 24, justifyContent: 'center' },
  keepLink: { alignItems: 'center', paddingVertical: 2, marginTop: -6 },
  keepText: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 13, textDecorationLine: 'underline' },
  disabled: { opacity: 0.35 },
  none: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { alignItems: 'center', marginBottom: spacing.sm },
  scrollHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: spacing.sm },
  scrollHintText: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  // flex:1 so the list fills the card and the Done button sits at the bottom; persistent scrollbar shows it scrolls.
  moveScroll: { alignSelf: 'stretch', flex: 1, marginTop: spacing.sm },
  moveList: { gap: 16, paddingVertical: 4 },
  moveCell: { width: '100%' },
  moveChar: { fontSize: 26, color: colors.ink, textAlign: 'center', marginBottom: 6 },
  track: { flexDirection: 'row', alignItems: 'center', height: 18 },
  half: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  halfLeft: { justifyContent: 'flex-end' },
  halfRight: { justifyContent: 'flex-start' },
  tick: { width: 2, height: 14, backgroundColor: colors.muted, borderRadius: 1 },
  bar: { height: 9, borderRadius: 999 },
  num: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  tag: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 4 },
  // Full card width, split between the two buttons (each flex: 1 below).
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  /*
   * Matched shells — same outline, padding and leading icon; only the fill separates them, so the
   * pair reads as two choices rather than a button next to a link.
   *
   * Both `flex: 1` rather than sized by their labels: content-width buttons overflowed the card,
   * and splitting the row means they fit whatever the wording or the screen.
   */
  // Rounded rather than the app's 14pt corner, and a size down on the label: two of them share a
  // row, and at 17pt the longer wording ran out of width.
  doneBtn: {
    ...btnPrimary(colors),
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  doneText: { ...btnLabel(colors), fontSize: 14 },
  backBtn: {
    ...btnSecondary(colors),
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  backText: { ...btnLabelQuiet(colors), fontSize: 14 },
})
