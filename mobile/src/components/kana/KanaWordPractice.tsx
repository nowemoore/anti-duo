import { useEffect, useMemo, useState } from 'react'
import { Animated, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { TapScale } from '../TapScale'
import { buildWordDrill, charsOf, recordResult, type WordItem } from '@lib/kana'
import type { KanaWord } from '@shared/types'
import { useContent } from '../../context/ContentContext'
import { useProgress } from '../../context/ProgressContext'
import { useScreenHeader } from '../../context/HeaderContext'
import { Bilingual } from '../Bilingual'
import { Icon } from '../Icon'
import { SpeakButton } from '../SpeakButton'
import { KanaWordChip } from '../TaskChip'
import { PagerChevron } from '../PagerChevron'
import { RevealSpacer } from '../RevealStrip'
import { Tally } from '../Tally'
import { useWordAudio } from './audio'
import { fonts, radius, shadow, spacing, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** What was answered. Doubles as the run's history, so answered questions can be paged back to. */
interface Answer {
  item: WordItem
  correct: boolean
  /** Which option was tapped, so revisiting a question still shows the choice that was made. */
  picked?: string
}

/**
 * Read whole words made of characters you already know.
 *
 * The sibling of {@link KanaPractice}: that one teaches sound→shape one glyph at a time, this one
 * puts the same glyphs into real words, where the mistakes are long vowels, small kana and voicing
 * marks. Deliberately built to the same layout — dots, a card that eases to the verdict colour, the
 * shared pager — so moving between the two doesn't feel like moving between two apps.
 *
 * **Every word shown is one the learner can actually read**: `buildWordDrill` only ever draws from
 * words whose every chart entry has been traced, so this can never ask about a character that hasn't
 * been met. See `src/lib/kana/words.ts`.
 */
export function KanaWordPractice({ onBack }: { onBack: () => void }) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const { progress, update } = useProgress()
  const play = useWordAudio()
  const kanaWords = useContent().content.kanaWords ?? []

  const [runId, setRunId] = useState(0)
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  const items = useMemo(
    () => buildWordDrill(progress, kanaWords),
    // `runId` is the reshuffle trigger; `progress` is deliberately excluded, or answering a question
    // would rebuild the list underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runId, kanaWords],
  )

  const item = items[i]
  const done = items.length > 0 && i >= items.length
  // Derived, not stored: answers are appended in order, so answers[i] *is* question i's answer.
  const answered = answers[i] ?? null

  useScreenHeader(
    done
      ? { ja: 'たんご', en: 'Words' }
      : { ja: `問題 ${i + 1}/${items.length}`, en: `Question ${i + 1}/${items.length}` },
  )

  const cardFade = useVerdictFade(answered != null)
  const cardTint = answered?.correct ? colors.correctSoft : colors.incorrectSoft
  const cardEdge = answered?.correct ? colors.correct : colors.incorrect

  // Spelling questions are listening questions: the word is spoken and the options differ only in
  // how they're written. A meaning question shows the word, so speaking it would give it away.
  useEffect(() => {
    if (item?.format === 'spell') play(item.word.word)
  }, [item, play])

  /**
   * Credit every character of the word, not the word itself.
   *
   * Reading パン correctly is evidence for パ and ン, and those are what the chart tracks — there is
   * no per-word mastery here. It's the same call the character drill makes for a sequence, so a word
   * run and a character run feed the same progress.
   */
  const resolve = (correct: boolean, picked?: string) => {
    if (!item || answered) return
    setAnswers((a) => [...a, { item, correct, picked }])
    update((p) => recordResult(p, charsOf(item.word.word), correct))
  }

  const step = (to: number) => setI(to)
  const next = () => step(i + 1)
  const prev = () => step(Math.max(0, i - 1))

  const restart = () => {
    setAnswers([])
    setI(0)
    setRunId((n) => n + 1)
  }

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          Study a few more characters in the charts, then whole words unlock here.
        </Text>
      </View>
    )
  }

  if (done) return <Summary answers={answers} onRestart={restart} onBack={onBack} />

  return (
    <>
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
        <KanaWordChip format={item.format} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {item.format === 'spell' ? (
            <>
              <TapScale
                style={styles.replay}
                onPress={() => play(item.word.word)}
                accessibilityRole="button"
                accessibilityLabel="Play the word again"
              >
                <Icon name="volume-high" size={20} color={colors.ink} />
              </TapScale>
              {/* The meaning is the prompt: it says *which* word without spelling it. */}
              <Text style={styles.prompt}>{item.word.gloss[0] ?? ''}</Text>
            </>
          ) : (
            /* The word is on screen, so hearing it gives nothing away — and a learner who can read
               it but has never heard it has only half of it. */
            <View style={styles.wordRow}>
              <Text style={styles.word}>{item.word.word}</Text>
              <SpeakButton text={item.word.word} label={`Pronounce ${item.word.word}`} />
            </View>
          )}

          <Options item={item} answered={answered} onAnswer={resolve} />
        </ScrollView>

        <View style={styles.pager}>
          <PagerChevron dir="prev" onPress={prev} disabled={i === 0} label="Previous question" />
          {answered ? (
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
      <RevealSpacer />
    </>
  )
}

/** The option list. Pre-shuffled by the generator, so presentation order carries no information. */
function Options({
  item,
  answered,
  onAnswer,
}: {
  item: WordItem
  answered: Answer | null
  onAnswer: (correct: boolean, picked?: string) => void
}) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const picked = answered?.picked ?? null

  return (
    <View style={styles.options}>
      {item.options.map((opt) => {
        const chosen = picked === opt.label
        // After answering, the right option is always marked — a wrong pick should show what was
        // right, not just that it was wrong.
        const state = !answered ? 'idle' : opt.correct ? 'right' : chosen ? 'wrong' : 'idle'
        return (
          <AnimatedPressable
            key={opt.label}
            style={[
              styles.option,
              // Spelling options are Japanese and want the larger face; meanings are English prose.
              item.format === 'spell' ? styles.optionKana : styles.optionText,
              state === 'right' && { borderColor: colors.correct, backgroundColor: colors.correctSoft },
              state === 'wrong' && { borderColor: colors.incorrect, backgroundColor: colors.incorrectSoft },
            ]}
            disabled={answered != null}
            onPress={() => onAnswer(opt.correct, opt.label)}
            accessibilityRole="button"
          >
            <View style={styles.optionRow}>
              <Text
                style={[
                  item.format === 'spell' ? styles.optionKanaText : styles.optionLabel,
                  state === 'right' && { color: colors.correct },
                  state === 'wrong' && { color: colors.incorrect },
                ]}
              >
                {opt.label}
              </Text>
              {/* Once the answer is out, the word you just placed is the thing you most want to hear
                  said back. Only on the revealed spelling: before that it would read every option
                  aloud, and on a meaning question the option is English. */}
              {state === 'right' && item.format === 'spell' && (
                <SpeakButton text={opt.label} label={`Pronounce ${opt.label}`} small />
              )}
            </View>
          </AnimatedPressable>
        )
      })}
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
  const play = useWordAudio()
  const right = answers.filter((a) => a.correct).length

  /**
   * The words that let the learner down, deduplicated by word.
   *
   * Unlike the character run, the word *is* the unit of study here — two misses of パン are one thing
   * to revisit, but パン and パーティー are two, even though they share a character.
   */
  const missed = [
    ...new Map(answers.filter((a) => !a.correct).map((a) => [a.item.word.idx, a.item.word])).values(),
  ]

  return (
    <>
      <View style={styles.panel}>
        <View style={styles.summaryTitle}>
          <Bilingual native="おつかれさま" en="Nice run!" large />
        </View>

        <ScrollView style={styles.summaryScroll} contentContainerStyle={styles.summaryBody}>
          <Tally count={right} total={answers.length} style={styles.score} />
          <Text style={styles.scoreSub}>
            {Math.round((right / Math.max(1, answers.length)) * 100)}% this run
          </Text>

          {missed.length > 0 && (
            <View style={styles.missed}>
              <Text style={styles.missedLabel}>Worth another look</Text>
              <View style={styles.missedRow}>
                {missed.map((w: KanaWord) => (
                  /* The whole chip plays, so the icon is a label rather than a nested button —
                     two tap targets one inside the other is worse than none. */
                  <TapScale
                    key={w.idx}
                    style={styles.missedChip}
                    onPress={() => play(w.word)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pronounce ${w.word}`}
                  >
                    <View style={styles.missedTop}>
                      <Text style={styles.missedWord}>{w.word}</Text>
                      <Icon name="volume-high" size={11} color={colors.muted} />
                    </View>
                    <Text style={styles.missedGloss}>{w.gloss[0] ?? ''}</Text>
                  </TapScale>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

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
      <RevealSpacer />
    </>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
    dotOn: { backgroundColor: colors.accent },
    dotGood: { backgroundColor: colors.correct },
    dotBad: { backgroundColor: colors.incorrect },

    panel: {
      flex: 1,
      backgroundColor: colors.panel,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      ...shadow,
    },
    scroll: { flex: 1 },
    content: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.lg },

    replay: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.recessed,
    },
    /** The English cue for a spelling question. */
    prompt: { color: colors.ink, fontFamily: fonts.medium, fontSize: 20, textAlign: 'center' },
    wordRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    missedTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    /** The word itself, for a meaning question. */
    word: { color: colors.ink, fontFamily: fonts.medium, fontSize: 40, textAlign: 'center' },

    options: { alignSelf: 'stretch', gap: spacing.sm },
    option: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.recessed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionKana: { paddingVertical: spacing.md },
    optionText: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
    optionKanaText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 26 },
    optionLabel: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, textAlign: 'center' },

    pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    verdictSlot: { flex: 1 },
    verdict: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
    verdictGood: { backgroundColor: colors.correctSoft },
    verdictBad: { backgroundColor: colors.incorrectSoft },
    verdictText: { fontFamily: fonts.medium, fontSize: 15 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    emptyText: {
      color: colors.muted,
      fontFamily: fonts.body,
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },

    summaryTitle: { alignItems: 'center', marginBottom: spacing.md },
    summaryScroll: { flex: 1 },
    summaryBody: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.md },
    score: { fontSize: 40 },
    scoreSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
    missed: { alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.sm },
    missedLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
    missedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    missedChip: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.recessed,
      alignItems: 'center',
    },
    missedWord: { color: colors.ink, fontFamily: fonts.medium, fontSize: 18 },
    missedGloss: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

    summaryActions: { flexDirection: 'row', gap: spacing.sm },
    backBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.recessed,
    },
    backText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14 },
    primary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    primaryText: { color: colors.onAccent, fontFamily: fonts.medium, fontSize: 14 },
  })
