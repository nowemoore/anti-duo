import { Animated, View, Text, Pressable, StyleSheet } from 'react-native'
import { type PluralTask } from '@lib/tasks'
import { VoweledText } from '../VoweledText'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { fadeColor, useVerdictFade } from '../../hooks/verdictFade'

/**
 * Singular ↔ plural: two lines — "1 [singular]" and "multiple [plural]" — with one form blanked out.
 * Choose the missing one. Language-agnostic; every language whose content tags plurals reuses this view.
 */
function PluralView({ task, answer, setAnswer, phase }: TaskViewProps<PluralTask, number | null>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const revealed = phase === 'revealed'
  const verdict = useVerdictFade(revealed)

  // A count-label + the word (or a blank, if this is the line being asked about; filled once revealed).
  const line = (count: string, form: string, blanked: boolean) => (
    <View style={styles.line}>
      <Text style={styles.count}>{count}</Text>
      {blanked && !revealed ? (
        <View style={styles.blank} />
      ) : (
        <VoweledText text={form} style={[styles.form, blanked && styles.formAnswer]} />
      )}
    </View>
  )

  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        {line('1', task.singular, task.ask === 'singular')}
        {line('multiple', task.plural, task.ask === 'plural')}
        <View style={styles.metaRow}>
          <Text style={styles.meaning}>{task.meaning}</Text>
          <SpeakButton text={task.ask === 'plural' ? task.plural : task.singular} label="Play the word" small />
        </View>
      </View>
      <View style={styles.grid}>
        {task.options.map((o, i) => {
          // Once revealed: the answer, your pick if it was wrong, and the also-rans, which recede.
          const state = !revealed
            ? answer === i
              ? 'selected'
              : 'idle'
            : o.correct
              ? 'correct'
              : answer === i
                ? 'wrong'
                : 'recessed'
          return (
            <AnimatedPressable key={i} disabled={revealed} onPress={() => setAnswer(i)} style={[styles.opt, optFade(verdict, state, colors)]}>
              <VoweledText text={o.label} style={[styles.optText, optTextStyle(state, colors)]} />
            </AnimatedPressable>
          )
        })}
      </View>
    </View>
  )
}

export const pluralTask: TaskUI<PluralTask, number | null> = {
  emptyAnswer: () => null,
  hasAnswer: (a) => a != null,
  View: PluralView,
  revealHint: (phase) => (phase === 'revealed' ? 'The missing form is filled in' : 'Pick the missing form'),
  resolve: (task, answer) =>
    answer == null ? { phase: 'retry' } : { phase: 'revealed', score: task.options[answer]?.correct ? 1 : -1 },
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * The chip's colours, eased across the reveal rather than swapped. Before the answer lands the fade
 * sits at 0, so the interpolation yields the idle or selected look and still tracks taps. Transparent
 * is spelled as a zero-alpha rgba because the keyword is not interpolable.
 */
function optFade(v: Animated.Value, state: string, colors: Palette) {
  const from =
    state === 'selected'
      ? { bg: colors.accentSoft, edge: colors.accent }
      : { bg: colors.panel, edge: colors.border }
  const to =
    state === 'correct'
      ? { bg: colors.correctSoft, edge: colors.correct }
      : state === 'wrong'
        ? { bg: colors.incorrectSoft, edge: colors.incorrect }
        : state === 'recessed'
          ? { bg: colors.recessed, edge: 'rgba(0,0,0,0)' }
          : from
  return {
    backgroundColor: fadeColor(v, from.bg, to.bg),
    borderColor: fadeColor(v, from.edge, to.edge),
  }
}
function optTextStyle(state: string, colors: Palette) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  if (state === 'recessed') return { color: colors.recessedInk }
  return null
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { width: '100%', alignItems: 'center' },
  prompt: { alignItems: 'center', gap: 10, marginBottom: 24 },
  // Each line: a small count label on the left, the (large) word or a blank on the right.
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 46 },
  count: { width: 76, textAlign: 'right', fontSize: 14, color: colors.muted, fontFamily: fonts.body },
  form: { fontSize: 34, color: colors.ink, fontFamily: fonts.klee },
  formAnswer: { color: colors.accentInk }, // the revealed answer stands out
  blank: {
    width: 96,
    height: 34,
    borderBottomWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  meaning: { fontSize: 14, color: colors.muted, fontFamily: fonts.body },
  grid: { flexDirection: 'column', gap: 10, alignSelf: 'center', width: '100%', maxWidth: 340 },
  opt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    alignItems: 'center',
  },
  optText: { fontSize: 22, color: colors.ink, fontFamily: fonts.klee },
})
