import { View, Text, Pressable, StyleSheet } from 'react-native'
import { checkChoice, type ChoiceTask } from '@lib/tasks'
import { SentenceView, type TokenOverride } from '../SentenceView'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { colors } from '../../theme'

function sentenceSpeech(task: ChoiceTask): string {
  return task.sentence.tokens.map((t) => t.surface).join('')
}

/** T3a/b/c: read the sentence, pick one option. Covers cloze / pick-reading / pick-meaning. */
function ChoiceView({ task, answer, setAnswer, phase }: TaskViewProps<ChoiceTask, number | null>) {
  const revealed = phase === 'revealed'
  const isCloze = task.kind === 'cloze' // select the target unit form
  const isPickReading = task.kind === 'pick-reading' // select pronunciation
  const isMeaning = !isCloze && !isPickReading // pick-meaning
  const stacked = isMeaning || isPickReading // both stack 1 per row

  let override: TokenOverride
  if (isCloze) {
    override = revealed ? { forceReading: true, highlight: true } : { blankChar: task.blankChar }
  } else if (isPickReading) {
    override = { highlight: true, hideReading: true }
  } else {
    override = { highlight: true, hideMeaning: true }
  }
  const overrides = { [task.tokenIndex]: override }

  return (
    <View style={styles.root}>
      <View style={styles.sentenceRow}>
        <View style={styles.sentenceWrap}>
          <SentenceView tokens={task.sentence.tokens} overrides={overrides} revealMeanings={revealed} />
        </View>
        <SpeakButton text={sentenceSpeech(task)} label="Play sentence" disabled={!revealed} small />
      </View>

      <View style={[styles.grid, stacked && styles.gridCol]}>
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
            <View key={i} style={[styles.cell, stacked && styles.cellFull, isPickReading && styles.readingCell]}>
              <Pressable
                disabled={revealed}
                onPress={() => setAnswer(i)}
                style={[styles.opt, isCloze && styles.optBig, stacked && styles.optSlim, isPickReading && styles.optFlex, optStyle(state)]}
              >
                <Text
                  style={[
                    styles.optText,
                    isCloze && styles.clozeOptText,
                    isPickReading && styles.readingText,
                    isMeaning && styles.meaningText,
                    optTextStyle(state),
                  ]}
                >
                  {o.label}
                </Text>
              </Pressable>
              {isPickReading && <SpeakButton text={o.label} label={`Play ${o.label}`} />}
            </View>
          )
        })}
      </View>
    </View>
  )
}

export const choiceTask: TaskUI<ChoiceTask, number | null> = {
  emptyAnswer: () => null,
  hasAnswer: (a) => a != null,
  View: ChoiceView,
  revealHint: (phase) => (phase === 'revealed' ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading'),
  resolve: (task, answer) =>
    answer == null ? { phase: 'retry' } : { phase: 'revealed', score: checkChoice(task, answer) ? 1 : -1 },
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
  root: { width: '100%' },
  sentenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  sentenceWrap: { flexShrink: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, alignSelf: 'center', width: '100%', maxWidth: 460 },
  gridCol: { flexDirection: 'column', flexWrap: 'nowrap', rowGap: 10, maxWidth: 340 },
  cell: { width: '48%' },
  cellFull: { width: '100%' },
  readingCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optFlex: { flex: 1 },
  optSlim: { paddingVertical: 9 },
  optBig: { paddingVertical: 18, minHeight: 56 },
  optText: { fontSize: 20, color: colors.ink },
  clozeOptText: { fontSize: 32 },
  readingText: { fontSize: 22 },
  meaningText: { fontSize: 16, textAlign: 'center' },
})
