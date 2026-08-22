import { useEffect, useMemo, useState } from 'react'
import { Animated, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { TapScale } from '../TapScale'
import { buildDrill, kanaOf, recordResult, type DrillItem } from '@lib/kana'
import { useAuth } from '../../context/AuthContext'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { Bilingual } from '../Bilingual'
import { DrawCanvas } from '../DrawCanvas'
import { Icon } from '../Icon'
import { KanaChip } from '../TaskChip'
import { PagerChevron } from '../PagerChevron'
import { RevealSpacer } from '../RevealStrip'
import { Tally } from '../Tally'
import { saveDrawing } from '../../lib/drawings'
import type { RawStroke } from '../../lang/ja/handwriting'
import { useKanaAudio } from './audio'
import {
  btnLabel,
  btnLabelQuiet,
  btnPrimary,
  btnSecondary,
  fonts,
  radius,
  shadow,
  spacing,
  type Palette,
} from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Stand-in unit for a logged kana drawing. The `drawings` table attributes every row to a numbered
 * curriculum unit, and kana has none — a negative id can't collide with a real one, and the `word`
 * column carries the character that was actually written.
 */
const KANA_UNIT_IDX = -1

/** What was answered. Doubles as the run's history, so answered questions can be paged back to. */
interface Answer {
  item: DrillItem
  correct: boolean
  /** Which option was tapped, so revisiting a question still shows the choice that was made. */
  picked?: string
}

/**
 * Listen and answer. Every question plays a sound — a single character or a short sequence — and
 * the learner picks it, types the romaji, or draws it, depending on how solid that character is.
 */
export function KanaPractice({ onBack }: { onBack: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress, update } = useProgress()
  const play = useKanaAudio()
  const userId = useAuth().session?.user?.id

  const [runId, setRunId] = useState(0)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  /**
   * Draw questions only: whether the answer has been shown yet, and whether anything is on the
   * canvas. Both live here rather than in `Draw` because the control that acts on them is the
   * pager's lock-in button, which sits outside the question.
   */
  const [revealed, setRevealed] = useState(false)
  const [strokes, setStrokes] = useState<RawStroke[]>([])
  const hasDrawn = strokes.length > 0

  const items = useMemo(
    () => buildDrill(progress),
    // `runId` is the reshuffle trigger; `progress` is deliberately excluded, or answering a question
    // would rebuild the list underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId],
  )

  const item = items[i]
  const done = items.length > 0 && i >= items.length
  // Derived, not stored: answers are appended in order, so answers[i] *is* question i's answer.
  const answered = answers[i] ?? null

  // No help button: a kana reference chart would be the answer key for every question here.
  // Same shape as the kanji session's header, so the two practice screens open identically.
  useScreenHeader(
    done
      ? { ja: 'れんしゅう', en: 'Practice' }
      : { ja: `問題 ${i + 1}/${items.length}`, en: `Question ${i + 1}/${items.length}` },
  )

  // The whole card eases to the verdict colour, exactly as the kanji session's does.
  const cardFade = useVerdictFade(answered != null)
  const cardTint = answered?.correct ? colors.correctSoft : colors.incorrectSoft
  const cardEdge = answered?.correct ? colors.correct : colors.incorrect

  // Play each question as it arrives.
  useEffect(() => {
    if (item) play(item.target)
  }, [item, play])

  /** Mastery is written per answer rather than at the end, so quitting mid-run keeps the credit. */
  const resolve = (correct: boolean, picked?: string) => {
    if (!item || answered) return
    setAnswers((a) => [...a, { item, correct, picked }])
    update((p) => recordResult(p, item.chars, correct))
  }

  const step = (to: number) => {
    setRevealed(false)
    setStrokes([])
    setI(to)
  }
  const next = () => step(i + 1)
  /**
   * Self-mark a draw question and move on in one tap: the verdict *is* the answer here, so pausing
   * on it would leave the learner staring at a card they've already finished with.
   */
  const mark = (correct: boolean) => {
    // Keep the strokes and the learner's own verdict: nothing on device can grade kana, so these
    // hand-marked attempts are the only training data this half of the app produces.
    // No signed-in user → nothing to attribute the row to, so don't attempt the insert at all.
    if (userId && item && strokes.length) {
      void saveDrawing({
        userId,
        lang: 'ja',
        // Kana isn't part of the numbered curriculum, so there's no unit to attribute it to.
        unitIdx: KANA_UNIT_IDX,
        word: item.target,
        strokes,
        correct: null, // no recognizer ran
        selfMarked: correct,
        mode: 'self',
      }).catch(() => {})
    }
    resolve(correct)
    step(i + 1)
  }
  const prev = () => step(Math.max(0, i - 1))

  const restart = () => {
    setAnswers([])
    setRevealed(false)
    setStrokes([])
    setI(0)
    setRunId((n) => n + 1)
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Open a character in one of the charts first.</Text>
      </View>
    )
  }

  if (done) return <Summary answers={answers} onRestart={restart} onBack={onBack} />

  return (
    <>
      {/* Dots sit above the card, where every other screen's step progress sits. */}
      <View style={styles.dots}>
        {items.map((_, n) => (
          <View
            key={n}
            style={[
              styles.dot,
              n === i && styles.dotOn,
              n < i && (answers[n]?.correct ? styles.dotGood : styles.dotBad),
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          styles.panel,
          {
            backgroundColor: fadeColor(cardFade, colors.panel, cardTint),
            borderColor: fadeColor(cardFade, colors.border, cardEdge),
          },
        ]}
      >
        {/* Outside the scroller, as in the kanji session: the chip labels the card, not the question. */}
        <KanaChip format={item.format} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          // A scroll parent claims the vertical drag mid-stroke, so scrolling is off while the canvas
          // is up. The draw question is sized to fit without it.
          scrollEnabled={item.format !== 'draw'}
        >
          <TapScale
            style={styles.replay}
            onPress={() => play(item.target)}
            accessibilityRole="button"
            accessibilityLabel="Play the sound again"
          >
            <Icon name="volume-high" size={20} color={colors.ink} />
          </TapScale>
          {item.format === 'pick' ? (
            <Pick item={item} answered={answered} onAnswer={resolve} />
          ) : (
            <Draw
              key={i}
              item={item}
              answered={answered}
              revealed={revealed}
              onStrokes={setStrokes}
            />
          )}

          {/* No answer line: a pick question already highlights the right option in green, and a
              draw question shows the character full size in its self-mark. */}
        </ScrollView>

        {/* The same pager the kanji session uses: chevrons either side of the verdict. */}
        <View style={styles.pager}>
          <PagerChevron dir="prev" onPress={prev} disabled={i === 0} label="Previous question" />
          {!answered && item.format === 'draw' && !revealed ? (
            /* Same slot, same button as the kanji session's lock-in — nothing is graded until you
               commit, and there's no going back to the canvas afterwards. */
            <TapScale
              style={[styles.lockBtn, !hasDrawn && styles.lockOff]}
              onPress={() => setRevealed(true)}
              disabled={!hasDrawn}
              accessibilityRole="button"
              accessibilityLabel="Lock in your answer"
            >
              <Icon name="lock" size={15} color={colors.onAccent} />
              <Text style={styles.lockText}>Lock in answer</Text>
            </TapScale>
          ) : !answered && item.format === 'draw' ? (
            /* Locked in, not yet marked. There is no grader for kana strokes, so the run waits here
               until you say how it went — the next chevron stays disabled meanwhile. */
            <View style={styles.markRow}>
              <TapScale
                style={[styles.markBtn, styles.markYes]}
                onPress={() => mark(true)}
                accessibilityRole="button"
              >
                <Text style={styles.markText}>Got this one right!</Text>
              </TapScale>
              <TapScale
                style={[styles.markBtn, styles.markNo]}
                onPress={() => mark(false)}
                accessibilityRole="button"
              >
                <Text style={styles.markText}>Will get next time!</Text>
              </TapScale>
            </View>
          ) : answered ? (
            <View style={[styles.verdict, answered.correct ? styles.verdictGood : styles.verdictBad]}>
              <Text
                style={[
                  styles.verdictText,
                  { color: answered.correct ? colors.correct : colors.incorrect },
                ]}
              >
                {answered.correct ? 'Correct' : 'Incorrect'}
              </Text>
            </View>
          ) : (
            <View style={styles.verdictSlot} />
          )}
          <PagerChevron
            dir="next"
            onPress={next}
            disabled={!answered}
            icon={i === items.length - 1 ? 'check' : undefined}
            label={i === items.length - 1 ? 'Finish' : 'Next question'}
          />
        </View>
      </Animated.View>
      {/* Nothing to hold and reveal here — the answer is the point. Space held so the card matches. */}
      <RevealSpacer />
    </>
  )
}

/**
 * Listen → pick. Options are pre-shuffled and guaranteed free of same-sounding entries, so there is
 * always exactly one answer that matches what was played.
 */
function Pick({
  item,
  answered,
  onAnswer,
}: {
  item: DrillItem
  answered: Answer | null
  onAnswer: (correct: boolean, picked?: string) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  // Read off the recorded answer rather than held locally, so paging back to a question still shows
  // which option was tapped.
  const picked = answered?.picked ?? null
  const reveal = answered != null
  // Answered: the answer highlights, the one you picked keeps a slate tint, the rest recede.
  const verdict = useVerdictFade(reveal)
  return (
    <View style={styles.options}>
      {item.options.map((o) => {
        return (
          <AnimatedPressable
            key={o.label}
            disabled={reveal}
            accessibilityRole="button"
            style={[
              styles.option,
              {
                backgroundColor: fadeColor(
                  verdict,
                  colors.panel,
                  o.correct
                    ? colors.correctSoft
                    : picked === o.label
                      ? colors.incorrectSoft
                      : colors.recessed,
                ),
                borderColor: fadeColor(
                  verdict,
                  colors.border,
                  o.correct
                    ? colors.correct
                    : picked === o.label
                      ? colors.incorrect
                      : 'rgba(0,0,0,0)',
                ),
              },
            ]}
            onPress={() => onAnswer(o.correct, o.label)}
          >
            <Text
              style={[
                styles.optionChar,
                item.chars.length > 1 && styles.optionCharSmall,
                reveal && !o.correct && picked !== o.label && styles.optionCharDead,
              ]}
            >
              {o.label}
            </Text>
          </AnimatedPressable>
        )
      })}
    </View>
  )
}

/**
 * Listen → draw. Self-assessed: there are no kana recognizer patterns, so the app can't grade the
 * strokes. The learner draws, reveals the answer, then says whether they had it — the same honesty
 * contract as the kanji draw task's override.
 */
function Draw({
  item,
  answered,
  revealed,
  onStrokes,
}: {
  item: DrillItem
  answered: Answer | null
  /** Locked in — the answer is on screen and the self-mark is up. Owned by the session. */
  revealed: boolean
  /** The strokes as drawn — the lock-in button watches them, and they're kept as training data. */
  onStrokes: (strokes: RawStroke[]) => void
}) {
  const styles = useStyles(makeStyles)

  return (
    <View style={styles.drawWrap}>
      <View style={styles.canvas}>
        {/* No guide: the whole point is recalling the shape unaided. */}
        <DrawCanvas
          disabled={answered != null || revealed}
          onStrokes={onStrokes}
          status={answered ? (answered.correct ? 'right' : 'wrong') : undefined}
        />
      </View>

      {/* The answer, full size. Marking it lives in the pager below — see the session's slot. */}
      {revealed ? <Text style={styles.selfMarkGlyph}>{item.target}</Text> : null}
    </View>
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
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const play = useKanaAudio()
  const right = answers.filter((a) => a.correct).length
  /*
   * The individual characters that let a question down, deduplicated.
   *
   * A missed sequence is evidence against every character in it, and listing the sequences instead
   * would put ねむ and ね in the list as if they were different things to revisit — they aren't, the
   * character is the unit of study here.
   */
  const missed = [...new Set(answers.filter((a) => !a.correct).flatMap((a) => a.item.chars))]

  return (
    <>
      {/* Laid out like the kanji session's summary: a title, a scrolling body that fills the card,
          then the same two actions pinned to the bottom. */}
      <View style={styles.panel}>
        <View style={styles.summaryTitle}>
          <Bilingual native="おつかれさま" en="Nice run!" large />
        </View>

        <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryBody}>
          <Tally count={right} total={answers.length} style={styles.score} />
          <Text style={styles.scoreSub}>{Math.round((right / Math.max(1, answers.length)) * 100)}% this run</Text>

          {missed.length > 0 && (
            <View style={styles.missed}>
              <Text style={styles.missedLabel}>Worth another look</Text>
              <View style={styles.missedRow}>
                {missed.map((char) => (
                  <TapScale key={char} style={styles.missedChip} onPress={() => play(char)}>
                    <Text style={styles.missedChar}>{char}</Text>
                    <Text style={styles.missedRomaji}>{kanaOf(char)?.romaji ?? ''}</Text>
                  </TapScale>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Carrying on is the likelier next step, so it takes the accent; leaving is the quiet one. */}
        <View style={styles.summaryActions}>
          <TapScale style={styles.backBtn} onPress={onBack}>
            <Icon name="chevron-left" size={12} color={colors.ink} />
            <Text style={styles.backText} numberOfLines={1}>
              Back to studying
            </Text>
          </TapScale>
          <TapScale style={styles.primary} onPress={onRestart}>
            <Icon name="rotate-left" size={12} color={colors.onAccent} />
            <Text style={styles.primaryText} numberOfLines={1}>
              Keep practising
            </Text>
          </TapScale>
        </View>
      </View>
      {/* Same reserved band as the questions, so the run doesn't resize when it ends. */}
      <RevealSpacer />
    </>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Matches every other card in the app: same shell, same shadow, same corner.
  panel: {
    ...shadow,
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  // Geometry copied from the shared step dots in StudyView's ScreenFrame — same size, same gap,
  // same standoff from the card. Only the answered-state colours are extra.
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 7,
    marginBottom: spacing.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  dotGood: { backgroundColor: colors.correct },
  dotBad: { backgroundColor: colors.incorrect },

  replay: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    // Grey glass, not the accent: it's a sound control, and those stay neutral app-wide.
    backgroundColor: colors.panelStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  // Same chip as the kanji multiple-choice options: neutral until answered, 1.5pt edge, 12pt corner.
  option: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  // Soft fills so the character itself stays legible while the verdict reads at a glance.
  optionCharDead: { color: colors.recessedInk },
  optionChar: { color: colors.ink, fontSize: 34, lineHeight: 42 },
  optionCharSmall: { fontSize: 24, lineHeight: 32 },

  drawWrap: { gap: spacing.md },
  canvas: { height: 250 },
  selfMarkGlyph: { color: colors.ink, fontSize: 56, lineHeight: 66, textAlign: 'center' },
  // The pair share the pager's middle slot, so they take the verdict pill's height between them.
  markRow: { flex: 1, flexDirection: 'row', gap: 8 },
  markBtn: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderRadius: 23,
    borderWidth: 1,
  },
  markYes: { backgroundColor: colors.correctSoft, borderColor: colors.correct },
  markNo: { backgroundColor: colors.incorrectSoft, borderColor: colors.incorrect },
  markText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 10, textAlign: 'center' },


  // Pager geometry copied from the kanji session, so the two cards end the same way.
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing.lg },
  verdictSlot: { flex: 1 },
  // Same lock-in button as the kanji session's pager, down to the 46pt stadium.
  lockBtn: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
  },
  lockOff: { opacity: 0.35 },
  lockText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  verdict: { flex: 1, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  verdictGood: { backgroundColor: colors.correctSoft },
  verdictBad: { backgroundColor: colors.incorrectSoft },
  verdictText: { fontFamily: fonts.semibold, fontSize: 14 },

  // The summary's two actions, matching the kanji session's pair exactly.
  summaryTitle: { alignItems: 'center', marginBottom: spacing.sm },
  summaryScroll: { alignSelf: 'stretch', flex: 1 },
  summaryBody: { gap: spacing.md, paddingVertical: spacing.sm },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primary: {
    ...btnPrimary(colors),
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  primaryText: { ...btnLabel(colors), fontSize: 14 },
  backBtn: {
    ...btnSecondary(colors),
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  backText: { ...btnLabelQuiet(colors), fontSize: 14 },

  score: { fontFamily: fonts.semibold, fontSize: 44, textAlign: 'center' },
  scoreSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  missed: { gap: spacing.sm, marginVertical: spacing.sm },
  missedLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  missedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  missedChip: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
  },
  missedChar: { color: colors.ink, fontSize: 22, lineHeight: 28 },
  missedRomaji: { color: colors.muted, fontFamily: fonts.body, fontSize: 10 },
})
