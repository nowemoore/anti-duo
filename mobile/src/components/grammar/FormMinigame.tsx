import { useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, PanResponder, Easing, Dimensions } from 'react-native'
import type { GrammarItemResult } from '@shared/types'
import { GRAMMAR_PASS_ACCURACY } from '@shared/constants'
import {
  maxVisitableIndex,
  prepareAttempt,
  type GrammarContext,
  type GrammarTopic,
  type PreparedItem,
} from '@lib/grammar'
import { Icon } from '../Icon'
import { RevealStrip } from '../RevealStrip'
import { Furigana } from '../../lang/ja/Furigana'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

const SCREEN_W = Dimensions.get('window').width

/** Option text scales down to fit, but never past these bounds. */
const OPT_MAX_FONT = 22
const OPT_MIN_FONT = 12

/**
 * The ✓/✗ slot is reserved on *both* sides of the label from the outset — empty until the answer is
 * revealed. Appending the icon on demand would shove the centred label sideways at the exact moment
 * the learner is reading it; mirroring the slot keeps the label optically centred either way.
 */
const OPT_ICON = 14
const OPT_ICON_GAP = 6

/** Progress dots shrink to keep the whole run on a single row, within these bounds. */
const DOT_MAX = 8
const DOT_MIN = 3
const DOT_GAP = 3

/** Largest dot size that fits `count` dots plus their gaps into `availableWidth`, on one line. */
function dotSize(count: number, availableWidth: number): number {
  const fit = Math.floor((availableWidth - (count - 1) * DOT_GAP) / count)
  return Math.max(DOT_MIN, Math.min(DOT_MAX, fit))
}

/**
 * Both options share one font size — the size that fits the *longer* of the two — so a long form
 * never renders smaller than its partner and the pair always reads as a fair comparison.
 * Kana are effectively full-width (~1em), so character count is a good width proxy.
 */
function optionFontSize(labels: string[], availableWidth: number): number {
  const longest = Math.max(...labels.map((l) => l.length), 1)
  const fit = availableWidth / (longest * 1.05)
  return Math.max(OPT_MIN_FONT, Math.min(OPT_MAX_FONT, Math.floor(fit)))
}

/**
 * Part 2 — binary choice. The verb sits inside the sentence frame, faint and bracketed, so it reads
 * as "this is the thing you're replacing"; the two candidate 〜ます forms sit side by side below.
 *
 * Navigation is entirely manual: answering an item never advances the card. Swipe or use the
 * chevrons to move in either direction, and finish the run explicitly once every item is answered.
 */
export function FormMinigame({
  topic,
  ctx,
  onFinish,
}: {
  topic: GrammarTopic
  /** Content + progress, for topics whose items are derived from what the learner knows. */
  ctx: GrammarContext
  /** Called once with the whole attempt's per-item results, in presentation order. */
  onFinish: (results: GrammarItemResult[]) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)

  // Prepared once and replaced wholesale on retry, so a reshuffle is explicit. Freezing it also
  // means the progress write at the end of a run can't reshape the run being played.
  const [prepared, setPrepared] = useState<PreparedItem[]>(() => prepareAttempt(topic, ctx))
  const [answers, setAnswers] = useState<(number | null)[]>(() => prepared.map(() => null))
  const [i, setI] = useState(0)
  const [done, setDone] = useState(false)
  // Measured from the options row; the estimate only governs the very first paint.
  const [rowWidth, setRowWidth] = useState(SCREEN_W - 64)
  // Text held in the reveal strip, or null for the hint. Cleared on release and on navigation.
  const [revealed, setRevealed] = useState<string | null>(null)

  const current = prepared[i]
  const picked = answers[i]
  const isFirst = i === 0
  const remaining = answers.filter((a) => a == null).length
  // Back is always open; forward stops at the first unanswered item, so you can step one ahead but
  // never skip a question. Answering the current one is what opens the next.
  const canGoNext = i < maxVisitableIndex(answers)

  const dragX = useRef(new Animated.Value(0)).current
  const animating = useRef(false)

  const snapBack = () => {
    Animated.spring(dragX, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 18 }).start()
  }
  const swap = (out: number, apply: () => void) => {
    if (animating.current) return
    animating.current = true
    Animated.timing(dragX, { toValue: out, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      apply()
      dragX.setValue(-out)
      Animated.timing(dragX, { toValue: 0, duration: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
        animating.current = false
      })
    })
  }

  const goPrev = () => {
    if (isFirst || animating.current) return
    setRevealed(null)
    swap(SCREEN_W, () => setI((n) => Math.max(0, n - 1)))
  }
  const goNext = () => {
    if (!canGoNext || animating.current) return
    setRevealed(null)
    swap(-SCREEN_W, () => setI((n) => n + 1))
  }

  // Rebuilt each render so the handlers close over the current index. Claims the gesture only when
  // it's clearly horizontal, leaving the surrounding vertical ScrollView alone.
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: () => false }))
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) =>
      !animating.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: (_e, g) => {
      // Resist dragging past either end — backward at the start, forward past an unanswered item.
      const resist = (isFirst && g.dx > 0) || (!canGoNext && g.dx < 0)
      dragX.setValue(resist ? g.dx * 0.3 : g.dx)
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -60 && canGoNext) goNext()
      else if (g.dx > 60 && !isFirst) goPrev()
      else snapBack()
    },
    onPanResponderTerminate: snapBack,
  })

  /** Answers are locked in on first tap, so revisiting an item can't be used to fix a miss. */
  function choose(optionIndex: number) {
    if (answers[i] != null) return
    setAnswers((prev) => prev.map((a, n) => (n === i ? optionIndex : a)))
  }

  function finish() {
    const results: GrammarItemResult[] = prepared.map((p, n) => {
      const option = p.options[answers[n]!]
      return { itemId: p.item.id, correct: option.correct, picked: option.label }
    })
    setDone(true)
    onFinish(results)
  }

  function retry() {
    const next = prepareAttempt(topic, ctx)
    setPrepared(next)
    setAnswers(next.map(() => null))
    setI(0)
    setDone(false)
  }

  if (done) {
    const correct = prepared.filter((p, n) => p.options[answers[n]!]?.correct).length
    const accuracy = correct / prepared.length
    const passed = accuracy >= GRAMMAR_PASS_ACCURACY
    return (
      <View style={styles.summary}>
        <Text style={styles.scoreBig}>
          {correct} / {prepared.length}
        </Text>
        <Text style={styles.scorePct}>{Math.round(accuracy * 100)}% correct</Text>
        <Text style={styles.scoreNote}>
          {passed
            ? 'Nice — the explanation is unlocked below.'
            : `${Math.round(GRAMMAR_PASS_ACCURACY * 100)}% unlocks the explanation. Your best attempt counts, so a retry can only help.`}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={retry}>
          <Icon name="rotate-left" size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  // Half the row, less the button's own padding and the two reserved icon slots.
  const optionWidth =
    (rowWidth - spacing.sm) / 2 - spacing.md * 2 - (OPT_ICON + OPT_ICON_GAP) * 2
  const fontSize = optionFontSize(current.options.map((o) => o.label), optionWidth)
  const dot = dotSize(prepared.length, rowWidth)

  return (
    <View>
      {/* Expectation-setting, kept up for the whole run (not just the first question) — it's the
          answer to "am I doing badly?", which is a question that arrives mid-run, not before it. */}
      {topic.minigame.intro ? <Text style={styles.intro}>{topic.minigame.intro}</Text> : null}

      {/* One dot per item, sized to keep the whole run on a single row. Filled once answered;
          the current one is scaled up — a transform, so it can't push the row onto two lines. */}
      <View style={styles.dots}>
        {prepared.map((p, k) => (
          <View
            key={p.item.id}
            style={[
              styles.dot,
              { width: dot, height: dot, borderRadius: dot / 2 },
              answers[k] != null && styles.dotAnswered,
              k === i && styles.dotCurrent,
            ]}
          />
        ))}
      </View>

      <Animated.View style={{ transform: [{ translateX: dragX }] }} {...pan.current.panHandlers}>
        {/* The verb sits in the frame in dictionary form, dimmed and bracketed: it's the slot to
            fill. Either word can be held for its meaning, which lands in the strip below. */}
        <View style={styles.prompt}>
          <View style={styles.frameRow}>
            <Pressable
              onPressIn={() => setRevealed(`${current.cue.word}  ·  ${current.cue.meaning}`)}
              onPressOut={() => setRevealed(null)}
              hitSlop={6}
              accessibilityLabel={`Meaning of ${current.cue.word}`}
            >
              <Furigana surface={current.cue.word} reading={current.cue.reading} baseStyle={styles.cueBase} />
            </Pressable>
            <View style={styles.slotRow}>
              <Text style={styles.bracket}>（</Text>
              <Pressable
                onPressIn={() => setRevealed(`${current.item.form}  ·  ${current.item.meaning}`)}
                onPressOut={() => setRevealed(null)}
                hitSlop={6}
                accessibilityLabel={`Meaning of ${current.item.form}`}
              >
                <Furigana
                  surface={current.item.form}
                  reading={current.item.reading}
                  baseStyle={styles.slotBase}
                  rtColor={colors.c500}
                />
              </Pressable>
              <Text style={styles.bracket}>）</Text>
            </View>
          </View>
        </View>

        <View style={styles.options} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
          {current.options.map((o, k) => {
            const revealed = picked != null
            const state = !revealed ? 'idle' : o.correct ? 'correct' : picked === k ? 'wrong' : 'idle'
            return (
              <Pressable
                key={o.label}
                disabled={revealed}
                onPress={() => choose(k)}
                style={[styles.opt, optStyle(state, colors)]}
                accessibilityRole="button"
                accessibilityLabel={o.label}
              >
                {/* Mirrored empty slot: keeps the label centred once the icon slot fills. */}
                <View style={styles.iconSlot} />
                <Text
                  numberOfLines={1}
                  style={[styles.optText, { fontSize }, optTextStyle(state, colors)]}
                >
                  {o.label}
                </Text>
                <View style={styles.iconSlot}>
                  {state === 'correct' && <Icon name="circle-check" size={OPT_ICON} color={colors.correct} />}
                  {state === 'wrong' && <Icon name="circle-xmark" size={OPT_ICON} color={colors.incorrect} />}
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* Same hold-to-reveal strip the practice exercises use, for the words in the frame. */}
        <RevealStrip text={revealed} hint="Hold a word above to reveal its meaning." />
      </Animated.View>

      <View style={styles.pager}>
        <Pressable
          style={[styles.chevron, styles.chevBack, isFirst && styles.disabled]}
          onPress={goPrev}
          disabled={isFirst}
          accessibilityLabel="Previous question"
        >
          <Icon name="chevron-left" size={18} color={colors.muted} />
        </Pressable>

        <Pressable
          style={[styles.chevron, styles.chevNext, !canGoNext && styles.disabled]}
          onPress={goNext}
          disabled={!canGoNext}
          accessibilityLabel="Next question"
        >
          <Icon name="chevron-right" size={18} color={colors.onAccent} />
        </Pressable>
      </View>

      {/* Finishing is always an explicit act — nothing here ends the run on your behalf. */}
      {remaining === 0 && (
        <Pressable style={[styles.primaryBtn, styles.finishBtn]} onPress={finish}>
          <Icon name="check" size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>See your score</Text>
        </Pressable>
      )}
    </View>
  )
}

function optStyle(state: string, colors: Palette) {
  if (state === 'correct') return { borderColor: colors.correct, backgroundColor: colors.correctSoft }
  if (state === 'wrong') return { borderColor: colors.incorrect, backgroundColor: colors.incorrectSoft }
  return null
}
function optTextStyle(state: string, colors: Palette) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  return null
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  intro: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  // No wrapping: the dot size is computed to fit the whole run on one row.
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: DOT_GAP, marginBottom: spacing.md },
  dot: { backgroundColor: colors.border },
  dotAnswered: { backgroundColor: colors.accent, opacity: 0.5 },
  dotCurrent: { backgroundColor: colors.accent, opacity: 1, transform: [{ scale: 1.6 }] },
  prompt: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.panelStrong,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  frameRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm },
  cueBase: { fontSize: 26, color: colors.ink },
  // The slot: dimmed + bracketed so it reads as a placeholder to be replaced, not as the answer.
  slotRow: { flexDirection: 'row', alignItems: 'flex-end' },
  slotBase: { fontSize: 26, color: colors.c500 },
  bracket: { fontSize: 26, color: colors.c500, lineHeight: 32 },
  options: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  opt: {
    // flex:1 on both children with a fixed gap gives each option exactly half the row.
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: OPT_ICON_GAP,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
    paddingVertical: 15,
    paddingHorizontal: spacing.md,
    minHeight: 56,
  },
  optText: { color: colors.ink, flexShrink: 1 },
  // Reserved from the start so the ✓/✗ appearing can't nudge the label sideways.
  iconSlot: { width: OPT_ICON, alignItems: 'center', justifyContent: 'center' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  chevron: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chevBack: { borderWidth: 1.5, borderColor: colors.border },
  chevNext: { backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.accent },
  disabled: { opacity: 0.3 },
  summary: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  scoreBig: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 34, fontVariant: ['tabular-nums'] },
  scorePct: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 14 },
  scoreNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
  },
  finishBtn: { marginTop: spacing.md },
  primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 13 },
})
