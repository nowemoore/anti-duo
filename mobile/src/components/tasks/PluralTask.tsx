import { View, Text, Pressable, StyleSheet } from 'react-native'
import { type PluralTask } from '@lib/tasks'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { colors, fonts } from '../../theme'

/**
 * Pick-the-plural: shows the singular word (+ its reading as a transliteration aid), choose the plural.
 * Language-agnostic — every language whose content carries plural data reuses this exact view.
 */
function PluralView({ task, answer, setAnswer, phase }: TaskViewProps<PluralTask, number | null>) {
  const revealed = phase === 'revealed'
  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        <Text style={styles.word}>{task.word}</Text>
        {task.reading ? <Text style={styles.reading}>{task.reading}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.meaning}>{task.meaning}</Text>
          <SpeakButton text={task.reading || task.word} label={`Play ${task.word}`} small />
        </View>
      </View>
      <View style={styles.grid}>
        {task.options.map((o, i) => {
          const state = !revealed
            ? answer === i
              ? 'selected'
              : 'idle'
            : o.correct
              ? 'correct'
              : answer === i
                ? 'wrong'
                : 'idle'
          return (
            <Pressable key={i} disabled={revealed} onPress={() => setAnswer(i)} style={[styles.opt, optStyle(state)]}>
              <Text style={[styles.optText, optTextStyle(state)]}>{o.label}</Text>
            </Pressable>
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
  revealHint: (phase) => (phase === 'revealed' ? 'The plural is highlighted' : 'Pick the plural form'),
  resolve: (task, answer) =>
    answer == null ? { phase: 'retry' } : { phase: 'revealed', score: task.options[answer]?.correct ? 1 : -1 },
}

function optStyle(state: string) {
  if (state === 'selected') return { borderColor: colors.accent, backgroundColor: colors.accentSoft }
  if (state === 'correct') return { borderColor: colors.correct, backgroundColor: colors.correctSoft }
  if (state === 'wrong') return { borderColor: colors.incorrect, backgroundColor: colors.incorrectSoft }
  return null
}
function optTextStyle(state: string) {
  if (state === 'correct') return { color: colors.correct }
  if (state === 'wrong') return { color: colors.incorrect }
  return null
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center' },
  prompt: { alignItems: 'center', gap: 4, marginBottom: 22 },
  word: { fontSize: 44, color: colors.ink },
  reading: { fontSize: 16, color: colors.muted, fontFamily: fonts.body }, // transliteration / reading aid
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  optText: { fontSize: 22, color: colors.ink },
})
