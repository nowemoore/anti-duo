import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { toKana } from 'wanakana'
import { type TypeWordTask } from '@lib/tasks'
import { useContent } from '../../context/ContentContext'
import { useReveal } from '../RevealStrip'
import { SpeakButton } from '../SpeakButton'
import { Icon } from '../Icon'
import type { QAPhase } from './types'
import { colors, fonts, radius } from '../../theme'

interface Props {
  task: TypeWordTask
  value: string
  phase: QAPhase
  score: number
  onChange: (v: string) => void
  onLock: () => void
  onGiveUp: () => void
}

/** T1: show a word, type its reading. After answering, hold a kanji for its meaning (→ strip). */
export function TypeWordTaskView({ task, value, phase, score, onChange, onLock, onGiveUp }: Props) {
  const revealed = phase === 'revealed'
  const canLock = value.trim() !== '' && !revealed
  const { content } = useContent()
  const meanings = content.kanjiMeanings
  const reveal = useReveal()

  return (
    <View style={styles.root}>
      <View style={styles.promptRow}>
        <View style={styles.wordRow}>
            {[...task.word].map((ch, i) => {
              const m = meanings[ch]
              if (revealed && m) {
                return (
                  <Pressable
                    key={i}
                    onPressIn={() => reveal.show(`${ch}  ·  ${m.split(';')[0].trim()}`)}
                    onPressOut={reveal.hide}
                  >
                    <Text style={[styles.promptWord, styles.promptChar]}>{ch}</Text>
                  </Pressable>
                )
              }
              return (
                <Text key={i} style={styles.promptWord}>
                  {ch}
                </Text>
              )
            })}
          </View>
          <SpeakButton text={task.reading} label={`Pronounce ${task.word}`} disabled={!revealed} small />
        </View>

        <View style={styles.form}>
          <TextInput
            autoFocus={!revealed}
            editable={!revealed}
            value={value}
            onChangeText={(t) => onChange(toKana(t, { IMEMode: true }))}
            onSubmitEditing={() => canLock && onLock()}
            placeholder="かな / romaji"
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
            <Pressable
              onPressIn={() => reveal.show(`${task.word}  ·  ${task.meaning.split(';')[0].trim()}`)}
              onPressOut={reveal.hide}
              hitSlop={6}
            >
              <Text style={styles.answer}>
                {score <= 0 ? 'Answer: ' : ''}
                <Text style={styles.answerReading}>{task.reading}</Text>
              </Text>
              <Text style={styles.answerHint}>hold for the whole word’s meaning</Text>
            </Pressable>
          )}
        </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 14 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  promptWord: { fontSize: 40, color: colors.ink },
  promptChar: { textDecorationLine: 'underline', textDecorationColor: colors.border },
  form: { width: '100%', maxWidth: 320, gap: 10 },
  input: {
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
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
  answer: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  answerReading: { color: colors.ink, fontFamily: fonts.semibold, textDecorationLine: 'underline', textDecorationColor: colors.border },
  answerHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 2, opacity: 0.8 },
})

