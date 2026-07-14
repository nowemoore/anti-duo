import { View, Text, Pressable, StyleSheet } from 'react-native'
import { isWhichWordsPerfect, scoreWhichWords, type WhichWordsTask } from '@lib/tasks'
import { useReveal } from '../RevealStrip'
import { useLanguage } from '../../context/LanguageContext'
import { RootWord } from '../RootWord'
import { SpeakButton } from '../SpeakButton'
import type { TaskUI, TaskViewProps } from './types'
import { fonts, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'

/** T2: multi-select the real words. Tap toggles; hold reveals reading (→ + meaning once answered). */
function WhichWordsView({ task, answer, setAnswer, phase }: TaskViewProps<WhichWordsTask, number[]>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const revealed = phase === 'revealed'
  const reveal = useReveal()
  const pack = useLanguage()
  const selSet = new Set(answer)
  const toggle = (i: number) => {
    if (revealed) return
    const s = new Set(answer)
    s.has(i) ? s.delete(i) : s.add(i)
    setAnswer([...s])
  }

  return (
    <View style={styles.root}>
      <Text style={styles.promptForm}>{pack.displayForm?.(task.form) ?? task.form}</Text>

      <View style={styles.grid}>
        {task.options.map((o, i) => {
          const isSel = selSet.has(i)
          const state = revealed
            ? o.correct
              ? 'correct'
              : isSel
                ? 'wrong'
                : 'idle'
            : isSel
              ? 'selected'
              : 'idle'
          const revealText = revealed ? `${o.reading}  ·  ${o.meaning}` : o.reading
          const canReveal = revealed ? o.correct : true
          return (
            <View key={i} style={styles.cell}>
              <Pressable
                onPress={() => toggle(i)}
                onLongPress={canReveal ? () => reveal.show(revealText) : undefined}
                delayLongPress={150}
                onPressOut={reveal.hide}
                style={[styles.opt, optStyle(state, colors)]}
              >
                <RootWord
                  surface={o.word}
                  spans={revealed && o.correct ? pack.rootSpans?.(o.word, task.form) : undefined}
                  style={[styles.optWord, optTextStyle(state, colors)]}
                />
              </Pressable>
              {revealed && o.correct && (
                <SpeakButton text={o.reading} label={`Play ${o.word}`} small style={styles.optSpeak} />
              )}
            </View>
          )
        })}
      </View>

      {phase === 'retry' && (
        <Text style={styles.retry}>Not quite — adjust your selection and lock in once more.</Text>
      )}
    </View>
  )
}

export const whichWordsTask: TaskUI<WhichWordsTask, number[]> = {
  emptyAnswer: () => [],
  hasAnswer: () => true, // lockable with any (or no) selection
  View: WhichWordsView,
  revealHint: (phase) => (phase === 'revealed' ? 'Hold a word for its reading & meaning' : 'Hold a word for its reading'),
  resolve: (task, answer, phase) => {
    const sel = new Set(answer)
    if (phase === 'first' && !isWhichWordsPerfect(task, sel)) return { phase: 'retry' }
    return { phase: 'revealed', score: scoreWhichWords(task, sel) }
  },
}

function optStyle(state: string, colors: Palette) {
  if (state === 'selected') return { borderColor: colors.accent, backgroundColor: colors.accentSoft }
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
  root: { width: '100%' },
  // lineHeight fixed (matches the Learn card's bigForm) so the line size is the same in every language.
  promptForm: { fontSize: 64, lineHeight: 70, fontWeight: '600', color: colors.ink, textAlign: 'center', marginBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, alignSelf: 'center', width: '100%', maxWidth: 460 },
  cell: { width: '48%', position: 'relative' },
  opt: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    backgroundColor: colors.panel,
    alignItems: 'center',
  },
  optWord: { fontSize: 22, color: colors.ink },
  optSpeak: { position: 'absolute', top: 6, right: 6 },
  retry: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
})
