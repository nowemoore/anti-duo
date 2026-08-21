import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { buildDrill, kanaOf, recordResult, type DrillItem } from '@lib/kana'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { DrawCanvas } from '../DrawCanvas'
import { Icon } from '../Icon'
import { useKanaAudio } from './audio'
import { fonts, radius, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** What was answered, kept only for the end-of-run summary. */
interface Answer {
  item: DrillItem
  correct: boolean
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

  const [runId, setRunId] = useState(0)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [answered, setAnswered] = useState<Answer | null>(null)

  const items = useMemo(
    () => buildDrill(progress),
    // `runId` is the reshuffle trigger; `progress` is deliberately excluded, or answering a question
    // would rebuild the list underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId],
  )

  const item = items[i]
  const done = items.length > 0 && i >= items.length

  // No help button: a kana reference chart would be the answer key for every question here.
  useScreenHeader(onBack, { ja: 'れんしゅう', en: 'Practice' })

  // Play each question as it arrives.
  useEffect(() => {
    if (item) play(item.target)
  }, [item, play])

  /** Mastery is written per answer rather than at the end, so quitting mid-run keeps the credit. */
  const resolve = (correct: boolean) => {
    if (!item || answered) return
    setAnswered({ item, correct })
    setAnswers((a) => [...a, { item, correct }])
    update((p) => recordResult(p, item.chars, correct))
  }

  const next = () => {
    setAnswered(null)
    setI((n) => n + 1)
  }

  const restart = () => {
    setAnswered(null)
    setAnswers([])
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
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      // A scroll parent claims the vertical drag mid-stroke, so scrolling is off while the canvas is
      // up. The draw question is sized to fit without it.
      scrollEnabled={item.format !== 'draw'}
    >
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

      <Pressable
        style={styles.replay}
        onPress={() => play(item.target)}
        accessibilityRole="button"
        accessibilityLabel="Play the sound again"
      >
        <Icon name="volume-high" size={24} color={colors.onAccent} />
      </Pressable>
      <Text style={styles.prompt}>
        {item.chars.length > 1 ? 'A sequence — ' : ''}
        {item.format === 'pick' ? 'which one did you hear?' : 'draw what you heard'}
      </Text>

      {item.format === 'pick' ? (
        <Pick item={item} answered={answered} onAnswer={resolve} />
      ) : (
        <Draw key={i} item={item} answered={answered} onAnswer={resolve} />
      )}

      {answered && (
        <View style={styles.feedback}>
          <Text style={[styles.verdict, answered.correct ? styles.good : styles.bad]}>
            {answered.correct ? 'Correct' : 'Not quite'}
          </Text>
          <Text style={styles.reveal}>
            {item.target} — {romajiFor(item)}
          </Text>
          <Pressable style={styles.primary} onPress={next} accessibilityRole="button">
            <Text style={styles.primaryText}>{i === items.length - 1 ? 'Finish' : 'Next'}</Text>
            <Icon name="chevron-right" size={13} color={colors.onAccent} />
          </Pressable>
        </View>
      )}
    </ScrollView>
  )
}

/** Canonical romaji for the whole target, for the reveal line. */
function romajiFor(item: DrillItem): string {
  return item.chars.map((c) => kanaOf(c)?.romaji ?? '').join('')
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
  onAnswer: (correct: boolean) => void
}) {
  const styles = useStyles(makeStyles)
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <View style={styles.options}>
      {item.options.map((o) => {
        const reveal = answered != null
        return (
          <Pressable
            key={o.label}
            disabled={reveal}
            accessibilityRole="button"
            style={[
              styles.option,
              reveal && o.correct && styles.optionGood,
              reveal && picked === o.label && !o.correct && styles.optionBad,
            ]}
            onPress={() => {
              setPicked(o.label)
              onAnswer(o.correct)
            }}
          >
            <Text style={[styles.optionChar, item.chars.length > 1 && styles.optionCharSmall]}>
              {o.label}
            </Text>
          </Pressable>
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
  onAnswer,
}: {
  item: DrillItem
  answered: Answer | null
  onAnswer: (correct: boolean) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const [revealed, setRevealed] = useState(false)

  return (
    <View style={styles.drawWrap}>
      <View style={styles.canvas}>
        {/* No guide: the whole point is recalling the shape unaided. */}
        <DrawCanvas disabled={answered != null} />
      </View>

      {!revealed ? (
        <Pressable style={styles.primary} onPress={() => setRevealed(true)} accessibilityRole="button">
          <Icon name="eye" size={13} color={colors.onAccent} />
          <Text style={styles.primaryText}>Show me</Text>
        </Pressable>
      ) : answered == null ? (
        <View style={styles.selfMark}>
          <Text style={styles.selfMarkGlyph}>{item.target}</Text>
          <Text style={styles.selfMarkAsk}>Did you get it?</Text>
          <View style={styles.selfMarkRow}>
            <Pressable style={[styles.markBtn, styles.markNo]} onPress={() => onAnswer(false)} accessibilityRole="button">
              <Icon name="xmark" size={13} color={colors.ink} />
              <Text style={styles.markText}>Missed it</Text>
            </Pressable>
            <Pressable style={[styles.markBtn, styles.markYes]} onPress={() => onAnswer(true)} accessibilityRole="button">
              <Icon name="check" size={13} color={colors.ink} />
              <Text style={styles.markText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
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
  const missed = answers.filter((a) => !a.correct)

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.score}>
        {right} <Text style={styles.scoreOf}>/ {answers.length}</Text>
      </Text>
      <Text style={styles.scoreSub}>{Math.round((right / Math.max(1, answers.length)) * 100)}% this run</Text>

      {missed.length > 0 && (
        <View style={styles.missed}>
          <Text style={styles.missedLabel}>Worth another look</Text>
          <View style={styles.missedRow}>
            {missed.map((a, n) => (
              <Pressable
                key={`${a.item.target}-${n}`}
                style={styles.missedChip}
                onPress={() => play(a.item.target)}
              >
                <Text style={styles.missedChar}>{a.item.target}</Text>
                <Text style={styles.missedRomaji}>{romajiFor(a.item)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Pressable style={styles.primary} onPress={onRestart} accessibilityRole="button">
        <Icon name="rotate-left" size={13} color={colors.onAccent} />
        <Text style={styles.primaryText}>Go again</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={onBack} accessibilityRole="button">
        <Text style={styles.secondaryText}>Done</Text>
      </Pressable>
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scroll: { flex: 1 },
  content: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', flexWrap: 'wrap' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  dotGood: { backgroundColor: colors.correct },
  dotBad: { backgroundColor: colors.incorrect },

  replay: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  option: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  // Soft fills so the character itself stays legible while the verdict reads at a glance.
  optionGood: { backgroundColor: colors.correctSoft, borderColor: colors.correct },
  optionBad: { backgroundColor: colors.incorrectSoft, borderColor: colors.incorrect },
  optionChar: { color: colors.ink, fontSize: 34, lineHeight: 42 },
  optionCharSmall: { fontSize: 24, lineHeight: 32 },

  drawWrap: { gap: spacing.md },
  canvas: { height: 250 },
  selfMark: { alignItems: 'center', gap: spacing.sm },
  selfMarkGlyph: { color: colors.ink, fontSize: 56, lineHeight: 66 },
  selfMarkAsk: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  selfMarkRow: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch' },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  markYes: { backgroundColor: colors.correctSoft, borderColor: colors.correct },
  markNo: { backgroundColor: colors.incorrectSoft, borderColor: colors.incorrect },
  markText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },

  feedback: { gap: spacing.sm },
  verdict: { fontFamily: fonts.semibold, fontSize: 16, textAlign: 'center' },
  reveal: { color: colors.ink, fontFamily: fonts.medium, fontSize: 20, textAlign: 'center' },
  good: { color: colors.correct },
  bad: { color: colors.incorrect },

  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
  },
  primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
  secondaryText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },

  score: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 44, textAlign: 'center' },
  scoreOf: { color: colors.muted, fontFamily: fonts.body, fontSize: 22 },
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
