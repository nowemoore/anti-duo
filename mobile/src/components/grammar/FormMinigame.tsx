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
const DOT_MIN_GAP = 2

/** Page 0 is the framing slide; questions are pages 1..n. */
const INTRO_PAGE = 0

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

/** Largest dot that lets `count` dots plus a minimum gap span `availableWidth` on one line. */
function dotSize(count: number, availableWidth: number): number {
  const fit = Math.floor(availableWidth / count) - DOT_MIN_GAP
  return Math.max(DOT_MIN, Math.min(DOT_MAX, fit))
}

/**
 * Part 2 — binary choice. The verb sits inside the sentence frame, faint and bracketed, so it reads
 * as "this is the thing you're replacing"; the two candidate 〜ます forms sit side by side below.
 *
 * Navigation is entirely manual: answering an item never advances the card. Swipe or use the
 * chevrons to move in either direction, finish explicitly, and go back to browse afterwards.
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
  const colors = useColors()
  const styles = useStyles(makeStyles)

  // Prepared once and replaced wholesale on retry, so a reshuffle is explicit. Freezing it also
  // means the progress write at the end of a run can't reshape the run being played.
  const [prepared, setPrepared] = useState<PreparedItem[]>(() => prepareAttempt(topic, ctx))
  const [answers, setAnswers] = useState<(number | null)[]>(() => prepared.map(() => null))
  const hasIntro = Boolean(topic.minigame.intro)
  const [page, setPage] = useState(hasIntro ? INTRO_PAGE : 1)
  /** 'run' = the pager, 'summary' = the score card. Toggling between them never re-records. */
  const [view, setView] = useState<'run' | 'summary'>('run')
  const recorded = useRef(false)
  const [rowWidth, setRowWidth] = useState(SCREEN_W - 64)
  // Text held in the reveal strip, or null for the hint. Cleared on release and on navigation.
  const [revealed, setRevealed] = useState<string | null>(null)

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
    if (!canGoPrev || animating.current) return
    setRevealed(null)
    swap(SCREEN_W, () => setPage((n) => n - 1))
  }
  const goNext = () => {
    if (!canGoNext || animating.current) return
    setRevealed(null)
    swap(-SCREEN_W, () => setPage((n) => n + 1))
  }

  // Rebuilt each render so the handlers close over the current page. Claims the gesture only when
  // it's clearly horizontal, leaving the surrounding vertical ScrollView alone.
  const pan = useRef(PanResponder.create({ onMoveShouldSetPanResponder: () => false }))
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) =>
      !animating.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: (_e, g) => {
      // Resist dragging past either end — backward at the start, forward past an unanswered item.
      const resist = (!canGoPrev && g.dx > 0) || (!canGoNext && g.dx < 0)
      dragX.setValue(resist ? g.dx * 0.3 : g.dx)
    },
    onPanResponderRelease: (_e, g) => {
      if (g.dx < -60 && canGoNext) goNext()
      else if (g.dx > 60 && canGoPrev) goPrev()
      else snapBack()
    },
    onPanResponderTerminate: snapBack,
  })

  /** Answers are locked in on first tap, so revisiting an item can't be used to fix a miss. */
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
      <View style={styles.summary}>
        <Text style={styles.scoreBig}>
          {correct} / {prepared.length}
        </Text>
        <Text style={styles.scorePct}>{Math.round(accuracy * 100)}% correct</Text>
        <Text style={styles.scoreNote}>
          {passed
            ? 'Nice — the explanation unlocks once you finish the reflection below.'
            : `${Math.round(GRAMMAR_PASS_ACCURACY * 100)}% unlocks the explanation. Your best attempt counts, so a retry can only help.`}
        </Text>
        {/* Reviewing is as useful as retrying — the answers are still there to look through. */}
        <Pressable style={[styles.primaryBtn, styles.ghostBtn]} onPress={() => { setPage(1); setView('run') }}>
          <Icon name="magnifying-glass" size={13} color={colors.accentInk} />
          <Text style={[styles.primaryText, styles.ghostText]}>Review your answers</Text>
        </Pressable>
        <Pressable style={styles.primaryBtn} onPress={retry}>
          <Icon name="rotate-left" size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  const optionWidth =
    (rowWidth - spacing.sm) / 2 - spacing.md * 2 - (OPT_ICON + OPT_ICON_GAP) * 2
  const fontSize = current ? optionFontSize(current.options.map((o) => o.label), optionWidth) : OPT_MAX_FONT
  const dot = dotSize(prepared.length, rowWidth)

  return (
    <View>
      {/* One dot per question, spread across the full width. The current one scales up — a
          transform, so emphasising it can't push the row onto a second line. */}
      <View style={styles.dots} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
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
        {onIntro ? (
          // Framing as its own slide, so it's read once and then out of the way rather than sitting
          // above every question.
          <View style={styles.introCard}>
            <Icon name="circle-question" size={22} color={colors.accentInk} />
            <Text style={styles.introText}>{topic.minigame.intro}</Text>
            <Text style={styles.introHint}>Swipe or tap → to begin.</Text>
          </View>
        ) : (
          <>
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

            <View style={styles.options}>
              {current.options.map((o, k) => {
                const revealedAnswer = picked != null
                const state = !revealedAnswer ? 'idle' : o.correct ? 'correct' : picked === k ? 'wrong' : 'idle'
                return (
                  <Pressable
                    key={o.label}
                    disabled={revealedAnswer}
                    onPress={() => choose(k)}
                    style={[styles.opt, optStyle(state, colors)]}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}
                  >
                    {/* Mirrored empty slot: keeps the label centred once the icon slot fills. */}
                    <View style={styles.iconSlot} />
                    <Text numberOfLines={1} style={[styles.optText, { fontSize }, optTextStyle(state, colors)]}>
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
          </>
        )}
      </Animated.View>

      <View style={styles.pager}>
        <Pressable
          style={[styles.chevron, styles.chevBack, !canGoPrev && styles.disabled]}
          onPress={goPrev}
          disabled={!canGoPrev}
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

      {/* Finishing is always an explicit act — nothing here ends the run on your behalf. Once the
          attempt is recorded this button becomes the way back to the score. */}
      {remaining === 0 && (
        <Pressable style={[styles.primaryBtn, styles.finishBtn]} onPress={finish}>
          <Icon name={recorded.current ? 'chart-column' : 'check'} size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>{recorded.current ? 'Back to your score' : 'See your score'}</Text>
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
  // space-between spreads the dots edge to edge; the computed size guarantees they still fit one row.
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: spacing.md,
  },
  dot: { backgroundColor: colors.border },
  dotAnswered: { backgroundColor: colors.accent, opacity: 0.5 },
  dotCurrent: { backgroundColor: colors.accent, opacity: 1, transform: [{ scale: 1.6 }] },
  introCard: {
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 190,
    justifyContent: 'center',
    backgroundColor: colors.panelStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  introText: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  introHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, fontStyle: 'italic' },
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
  summary: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  scoreBig: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 34, fontVariant: ['tabular-nums'] },
  scorePct: { color: colors.accentInk, fontFamily: fonts.semibold, fontSize: 14 },
  scoreNote: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
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
  ghostBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
  ghostText: { color: colors.accentInk },
  finishBtn: { marginTop: spacing.md },
  primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 13 },
})
