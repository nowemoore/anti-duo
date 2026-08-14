import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import type { Progress } from '@shared/types'
import { INTRODUCED_LEVEL, LEVEL_FLOOR, PRACTICE_ITERATIONS } from '@shared/constants'
import { introducedUnits, isForgottenLevel } from '@lib/study'
import { awardDelta, levelDeltaFor, pickTarget } from '@lib/practice'
import { amendTaskResult, recordTaskResult, recordWordResult, restoreWordStreak } from '@lib/stats'
import { generateAnyTask, testedWord, WHICH_WORDS_OPTIONS, WHICH_WORDS_POINT } from '@lib/tasks'
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
import type { DrawStroke } from '../lang/types'
import { fonts, radius, shadow, spacing, type Palette } from '../theme'
import { useColors, useStyles } from '../hooks/theme'

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

export function PracticeSession({ onExit }: { onExit: () => void }) {
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
    const targetIdx = pickTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (targetIdx == null) return null
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
    return { task, targetIdx, answer: ui ? ui.emptyAnswer() : null, phase: 'first', score: 0, recorded: false }
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
    onExit,
    done || !qa ? undefined : { ja: qHead.native, en: qHead.en },
    done || !qa ? undefined : { current: pos + 1, total },
  )

  /**
   * Apply a revealed question's score to the working levels + persisted progress (once).
   * Returns the level change actually applied, so the caller can store it on the QA for `override`.
   */
  const record = (item: QA): { levelDelta: number; prevWordStreak: number } => {
    // Damped while the kanji is still warming up, so a new one can't be un-learned by one miss.
    const cur = workingRef.current[item.targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const levelDelta = levelDeltaFor(item.task.kind, item.score, cur)
    if (levelDelta !== 0) {
      const nextLvl = Math.max(LEVEL_FLOOR, cur + levelDelta)
      workingRef.current = { ...workingRef.current, [item.targetIdx]: { lvl: nextLvl } }
    }
    // Per-word "known" run, for the Stats card. Only tasks that test one specific word count —
    // which-words shows four at once, so a good score there isn't evidence about any one of them.
    // Sentence-derived words are checked against the curated vocabulary: a cloze can focus an
    // inflection (食べた) which shouldn't be tracked separately from its dictionary form.
    const tested = testedWord(item.task)
    const word = tested && index.words.has(tested) ? tested : null
    // Read before the update so an override can put it back exactly. Safe to read from the rendered
    // progress: exactly one answer is recorded per question, and each needs its own tap.
    const prevWordStreak = word ? (progress.words?.[word] ?? 0) : 0
    update((p) => {
      let next = levelDelta !== 0 ? awardDelta(p, item.targetIdx, levelDelta) : p
      next = recordTaskResult(next, item.task.kind, item.score)
      return word ? recordWordResult(next, word, isCorrect(item)) : next
    })
    prevTargetRef.current = item.targetIdx

    // Persist the drawing (with the recognizer's verdict) to Supabase — a history. Fire-and-forget:
    // a save failure must never disrupt practice. A later override updates the row (via its id).
    if (item.task.kind === 'draw' && userId) {
      const strokes = item.answer as DrawStroke[]
      if (Array.isArray(strokes) && strokes.length) {
        const at = pos
        const word = item.task.word
        // Practice only ever offers recognizer-graded words; tracing lives in the write review.
        saveDrawing({ userId, lang: pack.id, unitIdx: item.targetIdx, word, strokes, correct: item.score > 0, mode: 'recognized' })
          .then((id) => {
            if (id) drawingIdRef.current[at] = id
          })
          .catch(() => {})
      }
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
    const res = ui.resolve(qa.task, qa.answer, qa.phase, pack)
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
    if (!qa || qa.phase !== 'revealed' || qa.overridden) return
    const recognizerCorrect = isCorrect(qa) // the verdict being disputed (before we re-score)
    const learnerCorrect = !recognizerCorrect
    const newScore = learnerCorrect ? 1 : -1

    // Re-derive the delta from the level *before* this answer touched it, so warm-up damping is
    // applied against the same level the original verdict saw.
    const applied = qa.appliedDelta ?? 0
    const cur = workingRef.current[qa.targetIdx]?.lvl ?? INTRODUCED_LEVEL
    const newDelta = levelDeltaFor(qa.task.kind, newScore, cur - applied)
    const correction = newDelta - applied
    workingRef.current = { ...workingRef.current, [qa.targetIdx]: { lvl: Math.max(LEVEL_FLOOR, cur + correction) } }
    patch({ ...qa, score: newScore, overridden: true, appliedDelta: newDelta })

    const tested = testedWord(qa.task)
    const word = tested && index.words.has(tested) ? tested : null
    update((p) => {
      let next = correction !== 0 ? awardDelta(p, qa.targetIdx, correction) : p
      // Swap the points the original verdict earned for the learner's, without a second attempt.
      next = amendTaskResult(next, qa.task.kind, qa.score, newScore)
      // Rewind the run to before the disputed answer, then apply the verdict the learner gave.
      if (word) next = recordWordResult(restoreWordStreak(next, word, qa.prevWordStreak ?? 0), word, learnerCorrect)
      return next
    })
    const id = drawingIdRef.current[pos]
    if (id) void overrideDrawing(id, recognizerCorrect).catch(() => {})
    next()
  }

  if (done || !qa) {
    return <Summary working={workingRef.current} startLevels={startLevelsRef.current} index={index} onExit={onExit} />
  }

  const ui = getTaskUI(qa.task.kind, pack)
  const revealed = qa.phase === 'revealed'
  const correct = revealed && isCorrect(qa)
  const overridden = revealed && !!qa.overridden
  const pagerLock = ui?.pagerLock !== false // type-word renders its own inline lock
  const canLock = !revealed && !!ui && ui.hasAnswer(qa.answer)
  const canPrev = pos > 0
  const canNext = pos < history.length - 1 || revealed

  return (
    <View style={styles.panel}>
      <RevealContextProvider value={revealApi}>
        <ScrollView
          style={styles.taskScroll}
          contentContainerStyle={styles.taskScrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={ui?.scrollable !== false} // a task (draw) may disable scroll to own its gestures
        >
          {/* key on pos fades each question in and gives a clean mount; back-nav replays answers. */}
          <FadeView key={pos}>
            <TaskRunner qa={qa} setAnswer={setAnswer} onLock={lockIn} onGiveUp={giveUp} />
          </FadeView>
          {/* A task's verdict override (draw) sits right under the answer — either direction. */}
          {ui?.overrideLabel && revealed && !correct && !overridden && (
            <Pressable style={styles.keepLink} onPress={override} hitSlop={8}>
              <Text style={styles.keepText}>{ui.overrideLabel}</Text>
            </Pressable>
          )}
          {ui?.overrideWrongLabel && revealed && correct && !overridden && (
            <Pressable style={styles.keepLink} onPress={override} hitSlop={8}>
              <Text style={styles.keepText}>{ui.overrideWrongLabel}</Text>
            </Pressable>
          )}
        </ScrollView>
      </RevealContextProvider>

      {/* Bottom reveal strip: hold a word to see its reading/meaning. Tasks that own their space (draw) omit it. */}
      {ui?.revealHint && <RevealStrip text={reveal} hint={ui.revealHint(qa.phase, pack)} />}

      <View style={styles.pager}>
        <Pressable
          style={[styles.chevron, styles.chevSide, !canPrev && styles.disabled]}
          onPress={prev}
          disabled={!canPrev}
          accessibilityLabel="Previous question"
        >
          <Icon name="chevron-left" size={18} color={colors.muted} />
        </Pressable>

        {revealed ? (
          <View style={[styles.verdict, overridden ? styles.verdictKept : correct ? styles.verdictCorrect : styles.verdictWrong]}>
            <Text style={[styles.verdictText, { color: overridden ? colors.muted : correct ? colors.correct : colors.incorrect }]}>
              {overridden ? 'Kept' : correct ? 'Correct' : 'Incorrect'}
            </Text>
          </View>
        ) : pagerLock ? (
          <Pressable
            style={[styles.lockBtn, styles.lockActive, !canLock && styles.disabled]}
            onPress={lockIn}
            disabled={!canLock}
            accessibilityLabel="Lock in your answer"
          >
            <Icon name="lock" size={15} color={colors.onAccent} />
            <Text style={[styles.lockText, { color: colors.onAccent }]}>Lock in answer</Text>
          </Pressable>
        ) : (
          <View style={styles.lockSlot} />
        )}

        <Pressable
          style={[styles.chevron, styles.chevNext, !canNext && styles.disabled]}
          onPress={next}
          disabled={!canNext}
          accessibilityLabel="Next question"
        >
          <Icon name="chevron-right" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  )
}

interface SummaryProps {
  working: Levels
  startLevels: Record<number, number>
  index: ReturnType<typeof useContent>
  onExit: () => void
}

function Summary({ working, startLevels, index, onExit }: SummaryProps) {
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

      <Pressable style={styles.doneBtn} onPress={onExit}>
        <Icon name="check" size={15} color={colors.onAccent} />
        <Text style={styles.doneText}>Done</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  taskScroll: { flex: 1 },
  taskScrollContent: { flexGrow: 1, justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  chevron: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  chevSide: { borderWidth: 1.5, borderColor: colors.border },
  chevNext: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.accent },
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
  verdictKept: { backgroundColor: colors.border },
  verdictText: { fontFamily: fonts.semibold, fontSize: 14 },
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
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  doneText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 15 },
})
