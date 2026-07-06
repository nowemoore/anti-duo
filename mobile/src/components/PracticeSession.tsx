import { useCallback, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { toKana } from 'wanakana'
import type { Progress } from '@shared/types'
import { INTRODUCED_LEVEL, LEVEL_FLOOR, PRACTICE_ITERATIONS } from '@shared/constants'
import { introducedKanji } from '@lib/study'
import { awardDelta, pickTarget } from '@lib/practice'
import { recordTaskResult } from '@lib/stats'
import {
  checkChoice,
  checkTypeWord,
  generateAnyTask,
  isWhichWordsPerfect,
  scoreWhichWords,
  TASK_TUNING,
  WHICH_WORDS_OPTIONS,
  WHICH_WORDS_POINT,
} from '@lib/tasks'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'
import { useScreenHeader } from '../context/HeaderContext'
import { Bilingual } from './Bilingual'
import { Icon } from './Icon'
import { FadeView } from './FadeView'
import { RevealContextProvider, RevealStrip } from './RevealStrip'
import { TaskRunner } from './tasks/TaskRunner'
import type { QA } from './tasks/types'
import { scoreWord, type RawStroke } from '../lib/handwriting'
import { useDrawableWord } from '../hooks/useDrawableWord'
import { colors, fonts, radius, shadow, spacing } from '../theme'

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

/** Default hint for the bottom reveal strip, per task + answer state. */
function revealHint(qa: QA): string {
  const revealed = qa.phase === 'revealed'
  if (qa.task.kind === 'type-word') return revealed ? 'Hold a kanji for its meaning' : 'Type the reading, then lock in'
  return revealed ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading'
}

export function PracticeSession({ onExit }: { onExit: () => void }) {
  const index = useContent()
  const { progress, update } = useProgress()
  const canDrawWord = useDrawableWord()

  const workingRef = useRef<Levels>(
    Object.fromEntries(
      introducedKanji(index, progress).map((k) => [k.idx, { lvl: progress.kanji[k.idx]?.lvl ?? 1 }]),
    ),
  )
  const startLevelsRef = useRef<Record<number, number>>(
    Object.fromEntries(Object.entries(workingRef.current).map(([i, v]) => [Number(i), v.lvl])),
  )
  const prevTargetRef = useRef<number | null>(null)

  const makeQA = useCallback((): QA | null => {
    const synthetic: Progress = { ...progress, kanji: workingRef.current }
    const targetIdx = pickTarget(index, synthetic, { avoidIdx: prevTargetRef.current ?? undefined })
    if (targetIdx == null) return null
    const studySet = Object.keys(workingRef.current).map(Number)
    const task = generateAnyTask(index, targetIdx, {
      studySet,
      taskWeights: progress.settings.taskWeights,
      canDraw: canDrawWord, // enables 'draw-kanji' (mobile-only) for all-learned words
    })
    if (!task) return null
    return { task, targetIdx, chosen: null, selected: [], typed: '', strokes: [], phase: 'first', score: 0, recorded: false }
  }, [index, progress, canDrawWord])

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
  useScreenHeader(
    onExit,
    done || !qa ? undefined : { ja: `問題 ${pos + 1} / ${total}`, en: `Question ${pos + 1} / ${total}` },
    done || !qa ? undefined : { current: pos + 1, total },
  )

  /** Apply a revealed question's score to the working levels + persisted progress (once). */
  const record = (item: QA) => {
    const tuning = TASK_TUNING[item.task.kind]
    const levelDelta = item.score * (item.score >= 0 ? tuning.pointsUp : tuning.pointsDown)
    if (levelDelta !== 0) {
      const cur = workingRef.current[item.targetIdx]?.lvl ?? 1
      const nextLvl = Math.max(LEVEL_FLOOR, cur + levelDelta)
      workingRef.current = { ...workingRef.current, [item.targetIdx]: { lvl: nextLvl } }
    }
    update((p) =>
      recordTaskResult(levelDelta !== 0 ? awardDelta(p, item.targetIdx, levelDelta) : p, item.task.kind, item.score),
    )
    prevTargetRef.current = item.targetIdx
  }

  const patch = (updated: QA) => setHistory((h) => h.map((x, k) => (k === pos ? updated : x)))

  const lockIn = () => {
    if (!qa || qa.phase === 'revealed') return
    let updated: QA
    if (qa.task.kind === 'which-words') {
      const sel = new Set(qa.selected)
      updated =
        qa.phase === 'first' && !isWhichWordsPerfect(qa.task, sel)
          ? { ...qa, phase: 'retry' }
          : { ...qa, phase: 'revealed', score: scoreWhichWords(qa.task, sel) }
    } else if (qa.task.kind === 'type-word') {
      const answer = toKana(qa.typed)
      const typed = answer !== qa.typed ? answer : qa.typed
      if (checkTypeWord(qa.task, answer)) {
        updated = { ...qa, typed, phase: 'revealed', score: qa.phase === 'first' ? 1 : 0.5 }
      } else if (qa.phase === 'first') {
        updated = { ...qa, typed, phase: 'retry' }
      } else {
        updated = { ...qa, typed, phase: 'revealed', score: -1 }
      }
    } else if (qa.task.kind === 'draw-kanji') {
      updated = { ...qa, phase: 'revealed', score: scoreWord(qa.task.word, qa.strokes).correct ? 1 : -1 }
    } else {
      if (qa.chosen == null) return
      updated = { ...qa, phase: 'revealed', score: checkChoice(qa.task, qa.chosen) ? 1 : -1 }
    }
    if (updated.phase === 'revealed') {
      updated = { ...updated, recorded: true }
      patch(updated)
      record(updated)
    } else {
      patch(updated)
    }
  }

  const giveUp = () => {
    if (!qa || qa.phase === 'revealed') return
    const updated: QA = { ...qa, phase: 'revealed', score: -1, recorded: true }
    patch(updated)
    record(updated)
  }

  const setChosen = (i: number) =>
    setHistory((h) => h.map((x, k) => (k === pos && x.phase !== 'revealed' ? { ...x, chosen: i } : x)))
  const toggleSel = (i: number) =>
    setHistory((h) =>
      h.map((x, k) => {
        if (k !== pos || x.phase === 'revealed') return x
        const s = new Set(x.selected)
        s.has(i) ? s.delete(i) : s.add(i)
        return { ...x, selected: [...s] }
      }),
    )
  const setTyped = (v: string) =>
    setHistory((h) => h.map((x, k) => (k === pos && x.phase !== 'revealed' ? { ...x, typed: v } : x)))
  const setStrokes = (s: RawStroke[]) =>
    setHistory((h) => h.map((x, k) => (k === pos && x.phase !== 'revealed' ? { ...x, strokes: s } : x)))

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
   * Draw-kanji only: the recognizer read the answer as wrong, but the learner says it was right. Undo
   * the penalty that lock-in already applied (so the kanji isn't discounted), mark it kept, and move
   * on. It doesn't award points — it just declines to punish a likely-misread drawing.
   */
  const keepKanji = () => {
    if (!qa || qa.task.kind !== 'draw-kanji' || qa.phase !== 'revealed' || isCorrect(qa) || qa.overridden) return
    const correction = -qa.score * TASK_TUNING['draw-kanji'].pointsDown // score was < 0 → positive undo
    const cur = workingRef.current[qa.targetIdx]?.lvl ?? 1
    workingRef.current = { ...workingRef.current, [qa.targetIdx]: { lvl: Math.max(LEVEL_FLOOR, cur + correction) } }
    patch({ ...qa, score: 0, overridden: true })
    update((p) => awardDelta(p, qa.targetIdx, correction))
    next()
  }

  if (done || !qa) {
    return <Summary working={workingRef.current} startLevels={startLevelsRef.current} index={index} onExit={onExit} />
  }

  const revealed = qa.phase === 'revealed'
  const correct = revealed && isCorrect(qa)
  const overridden = revealed && !!qa.overridden
  const isType = qa.task.kind === 'type-word'
  const isDraw = qa.task.kind === 'draw-kanji'
  const hasAnswer =
    qa.task.kind === 'type-word'
      ? qa.typed.trim() !== ''
      : qa.task.kind === 'which-words'
        ? true
        : qa.task.kind === 'draw-kanji'
          ? qa.strokes.length > 0
          : qa.chosen != null
  const canLock = !revealed && hasAnswer
  const canPrev = pos > 0
  const canNext = pos < history.length - 1 || revealed

  return (
    <View style={styles.panel}>
      <RevealContextProvider value={revealApi}>
        <ScrollView
          style={styles.taskScroll}
          contentContainerStyle={styles.taskScrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!isDraw} // let finger-drawing own vertical drags on the canvas
        >
          {/* key on pos fades each question in and gives a clean mount; back-nav replays answers. */}
          <FadeView key={pos}>
            <TaskRunner
              qa={qa}
              onChoose={setChosen}
              onToggle={toggleSel}
              onChange={setTyped}
              onStrokes={setStrokes}
              onLock={lockIn}
              onGiveUp={giveUp}
            />
          </FadeView>
        </ScrollView>
      </RevealContextProvider>

      {/* Bottom reveal strip: hold a word/kanji to see its reading/meaning here (not for drawing). */}
      {!isDraw && <RevealStrip text={reveal} hint={revealHint(qa)} />}

      {/* Draw override: the recognizer can misread a correct drawing, so let the learner keep the kanji. */}
      {isDraw && revealed && !correct && !overridden && (
        <Pressable style={styles.keepLink} onPress={keepKanji} hitSlop={8}>
          <Text style={styles.keepText}>I think I got this one right</Text>
        </Pressable>
      )}

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
        ) : isType ? (
          <View style={styles.lockSlot} />
        ) : (
          <Pressable
            style={[styles.lockBtn, styles.lockActive, !canLock && styles.disabled]}
            onPress={lockIn}
            disabled={!canLock}
            accessibilityLabel="Lock in your answer"
          >
            <Icon name="lock" size={15} color={colors.onAccent} />
            <Text style={[styles.lockText, { color: colors.onAccent }]}>Lock in answer</Text>
          </Pressable>
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
  const moves = Object.entries(working)
    .map(([idx, v]) => {
      const i = Number(idx)
      return {
        idx: i,
        char: index.byIdx.get(i)?.char ?? '?',
        delta: v.lvl - (startLevels[i] ?? v.lvl),
        reteach: v.lvl < INTRODUCED_LEVEL,
      }
    })
    .filter((m) => m.delta !== 0)
    .sort((a, b) => b.delta - a.delta)

  const maxAbs = moves.reduce((m, x) => Math.max(m, Math.abs(x.delta)), 0)

  return (
    <View style={styles.panel}>
      <View style={styles.summaryTitle}>
        <Bilingual ja="進捗概要" en="Progress overview" large />
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
                <Text style={styles.moveChar}>{m.char}</Text>
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

const styles = StyleSheet.create({
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
  keepLink: { alignItems: 'center', paddingVertical: 4, marginBottom: 6 },
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
