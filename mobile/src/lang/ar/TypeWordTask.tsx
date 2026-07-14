import { useEffect } from 'react'
import { View, Text, TextInput, Pressable, Keyboard, StyleSheet } from 'react-native'
import { checkTypeWord, type TypeWordTask } from '@lib/tasks'
import { useContent } from '../../context/ContentContext'
import { SpeakButton } from '../../components/SpeakButton'
import { Icon } from '../../components/Icon'
import { RootWord } from '../../components/RootWord'
import { VoweledText } from '../../components/VoweledText'
import type { TaskUI, TaskViewProps } from '../../components/tasks/types'
import { fonts, radius, type Palette } from '../../theme'
import { useColors, useStyles } from '../../hooks/theme'
import { stripHarakat } from './normalize'
import { rootSpans } from './roots'

/** Grade an Arabic answer leniently about short vowels, against the word, its reading, and alternates. */
function gradeAr(task: TypeWordTask, answer: string): boolean {
  if (checkTypeWord(task, answer, stripHarakat)) return true
  return stripHarakat(answer.trim()) === stripHarakat(task.word.trim())
}

/**
 * Arabic type-word: production, not recognition — the prompt is the English meaning (showing the
 * written form would give the answer away, since Arabic spelling ≈ its reading). You type the Arabic
 * word; short vowels are optional. Owns its own lock / No-clue buttons (pagerLock: false).
 */
function ArTypeWordView({ task, answer, setAnswer, phase, score, onLock, onGiveUp }: TaskViewProps<TypeWordTask, string>) {
  const colors = useColors()
  const styles = useStyles(makeStyles)
  const revealed = phase === 'revealed'
  const canLock = answer.trim() !== '' && !revealed
  const index = useContent()
  const root = index.byIdx.get(task.targetIdx)?.form

  useEffect(() => {
    if (revealed) Keyboard.dismiss()
  }, [revealed])

  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        <Text style={styles.meaning}>{task.meaning}</Text>
        {root ? <Text style={styles.rootHint}>root · {root.trim().split(/\s+/).join(' · ')}</Text> : null}
      </View>

      <View style={styles.form}>
        <TextInput
          autoFocus={!revealed}
          editable={!revealed}
          value={answer}
          onChangeText={setAnswer}
          onSubmitEditing={() => canLock && onLock()}
          placeholder="اكتب بالعربية"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!revealed && (
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, styles.clueBtn]} onPress={onGiveUp} accessibilityLabel="No clue">
              <Icon name="skull" size={13} color={colors.muted} />
              <Text style={styles.clueText}>No clue</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.lockBtn, !canLock && styles.disabled]}
              onPress={onLock}
              disabled={!canLock}
              accessibilityLabel="Lock in your answer"
            >
              <Icon name="lock" size={14} color={colors.onAccent} />
              <Text style={styles.lockText}>Lock in answer</Text>
            </Pressable>
          </View>
        )}
        {phase === 'retry' && (
          <Text style={styles.retry}>Not quite — fix your answer and lock in once more.</Text>
        )}
        {revealed && (
          <View style={styles.answerRow}>
            <View style={styles.answerText}>
              <Text style={styles.answer}>
                {score <= 0 ? 'Answer: ' : ''}
                <RootWord
                  surface={task.word}
                  spans={root ? rootSpans(task.word, root) : undefined}
                  style={styles.answerWord}
                />
              </Text>
              <VoweledText text={task.reading} style={styles.answerReading} />
            </View>
            <SpeakButton text={task.reading} label={`Pronounce ${task.word}`} small />
          </View>
        )}
      </View>
    </View>
  )
}

export const arTypeWordTask: TaskUI<TypeWordTask, string> = {
  emptyAnswer: () => '',
  hasAnswer: (a) => a.trim() !== '',
  View: ArTypeWordView,
  pagerLock: false, // renders its own inline lock / No-clue
  revealHint: (phase) =>
    phase === 'revealed' ? 'The fully-vowelled form is shown below' : 'Type the Arabic word, then lock in',
  resolve: (task, answer, phase) => {
    if (gradeAr(task, answer)) return { phase: 'revealed', score: phase === 'first' ? 1 : 0.5, answer }
    if (phase === 'first') return { phase: 'retry', answer }
    return { phase: 'revealed', score: -1, answer }
  },
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: { alignItems: 'center', gap: 16 },
  prompt: { alignItems: 'center', gap: 4 },
  meaning: { fontSize: 30, color: colors.ink, fontFamily: fonts.semibold, textAlign: 'center' },
  rootHint: { fontSize: 14, color: colors.muted, fontFamily: fonts.body },
  form: { width: '100%', maxWidth: 320, gap: 10 },
  input: {
    fontSize: 26,
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.bg,
    width: '100%',
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: radius.pill,
  },
  lockBtn: { backgroundColor: colors.accent },
  lockText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 14 },
  clueBtn: { backgroundColor: colors.border },
  clueText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  retry: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  answerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  answerText: { alignItems: 'center' },
  answer: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  answerWord: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 22 },
  answerReading: { color: colors.accentInk, fontSize: 20, textAlign: 'center', writingDirection: 'rtl' },
})
