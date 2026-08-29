import { useEffect } from 'react'
import { View, Text, TextInput, Keyboard, StyleSheet } from 'react-native'
import { TapScale } from '../TapScale'
import { checkTypeWord, type TypeWordTask } from '@lib/tasks'
import { useContent } from '../../context/ContentContext'
import { useLanguage } from '../../context/LanguageContext'
import { useReveal } from '../RevealStrip'
import { SpeakButton } from '../SpeakButton'
import { Icon } from '../Icon'
import type { TaskUI, TaskViewProps } from './types'
import { colors, fonts, radius } from '../../theme'

/** Any CJK ideograph — kana and Latin fall outside it. */
const KANJI = /[㐀-䶿一-鿿豈-﫿]/
const isKanji = (ch: string) => KANJI.test(ch)

/** T1: show a word, type its reading. Owns its own lock / No-clue buttons (pagerLock: false). */
function TypeWordView({ task, answer, setAnswer, phase, score, onLock, onGiveUp }: TaskViewProps<TypeWordTask, string>) {
  const revealed = phase === 'revealed'
  const canLock = answer.trim() !== '' && !revealed
  const { content } = useContent()
  const { toReading, toReadingLive, inputHint, charGloss } = useLanguage()
  const convert = toReadingLive ?? toReading
  const reveal = useReveal()

  // Once answered, drop the keyboard — otherwise it stays up and hides the answer (below the input).
  useEffect(() => {
    if (revealed) Keyboard.dismiss()
  }, [revealed])

  return (
    <View style={styles.root}>
      <View style={styles.promptRow}>
        <View style={styles.wordRow}>
          {[...task.word].map((ch, i) => {
            const m = charGloss?.(content, ch)
            if (revealed && m) {
              return (
                <TapScale
                  key={i}
                  onPressIn={() => reveal.show(`${ch}  ·  ${m.split(';')[0].trim()}`)}
                  onPressOut={reveal.hide}
                >
                  <Text style={[styles.promptWord, isKanji(ch) && styles.kanji, styles.promptChar]}>
                    {ch}
                  </Text>
                </TapScale>
              )
            }
            return (
              <Text key={i} style={[styles.promptWord, isKanji(ch) && styles.kanji]}>
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
          value={answer}
          onChangeText={(t) => setAnswer(convert(t))}
          onSubmitEditing={() => canLock && onLock()}
          placeholder={inputHint}
          placeholderTextColor={colors.muted}
          // The caret and any selection carry the accent — half of the field's "this holds your
          // answer" mark, the outline being the other half.
          selectionColor={colors.accent}
          style={[
            styles.input,
            /*
             * Outlined in the accent for as long as it is the thing you answer with — not switched
             * on by a tap, and not by the first keystroke either. Tying it to state made the outline
             * and the caret disagree: the caret is accent the moment the field is live, so an
             * outline that waited for content read as the field failing to notice you.
             *
             * Outline and caret, nothing more. A fill behind live text is one more thing to read
             * through while you are still reading what you typed.
             */
            !revealed && styles.inputActive,
            revealed && (score > 0 ? styles.inputOk : styles.inputBad),
          ]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!revealed && (
          <View style={styles.actionRow}>
            <TapScale style={[styles.actionBtn, styles.clueBtn]} onPress={onGiveUp} accessibilityLabel="No clue">
              <Icon name="skull" size={13} color={colors.muted} />
              <Text style={styles.clueText}>No clue</Text>
            </TapScale>
            <TapScale
              style={[styles.actionBtn, styles.lockBtn, !canLock && styles.disabled]}
              onPress={onLock}
              disabled={!canLock}
              accessibilityLabel="Lock in your answer"
            >
              <Icon name="lock" size={14} color={colors.ink} />
              <Text style={styles.lockText}>Lock in answer</Text>
            </TapScale>
          </View>
        )}
        {/* Reserved: the retry line and the revealed answer both live here, so neither appearing
            shunts the input and buttons up the card. */}
        <View style={styles.answerSlot}>
          {phase === 'retry' && (
            <Text style={styles.retry}>Not quite — fix your answer and lock in once more.</Text>
          )}
          {revealed && (
            <TapScale
              onPressIn={() => reveal.show(`${task.word}  ·  ${task.meaning.split(';')[0].trim()}`)}
              onPressOut={reveal.hide}
              hitSlop={6}
            >
              <Text style={styles.answer}>
                {score <= 0 ? 'Answer: ' : ''}
                <Text style={styles.answerReading}>{task.reading}</Text>
              </Text>
              <Text style={styles.answerHint}>hold for the whole word’s meaning</Text>
            </TapScale>
          )}
        </View>
      </View>
    </View>
  )
}

export const typeWordTask: TaskUI<TypeWordTask, string> = {
  emptyAnswer: () => '',
  hasAnswer: (a) => a.trim() !== '',
  View: TypeWordView,
  pagerLock: false, // renders its own inline lock / No-clue
  revealHint: (phase, pack) =>
    phase === 'revealed'
      ? `Hold a ${pack.ui.noun}, or the answer for the whole word`
      : 'Type the reading, then lock in',
  resolve: (task, answer, phase, pack) => {
    const committed = pack.toReading(answer)
    if (checkTypeWord(task, committed)) return { phase: 'revealed', score: phase === 'first' ? 1 : 0.5, answer: committed }
    if (phase === 'first') return { phase: 'retry', answer: committed }
    return { phase: 'revealed', score: -1, answer: committed }
  },
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 14 },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Wraps rather than overflowing: the longest words in the curriculum are five characters
  // (待ち合わせ), which at this size is wider than a narrow phone's card.
  wordRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexWrap: 'wrap', justifyContent: 'center' },
  // The word is the whole question here, so it carries the card. Family is per character: kanji take
  // mincho, kana are left to the OS gothic (see `isKanji`).
  promptWord: { fontSize: 52, lineHeight: 62, color: colors.ink },
  kanji: { fontFamily: fonts.mincho },
  promptChar: { textDecorationLine: 'underline', textDecorationColor: colors.border },
  form: { width: '100%', maxWidth: 320, gap: 10 },
  input: {
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    // A hairline. The accent is doing the work of saying "answer here", and it says it better thin:
    // a heavy ring reads as a form field to be filled in, a fine one as a considered edge.
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    // Pill, like every other control that takes an answer on this card.
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    width: '100%',
  },
  inputActive: { borderColor: colors.accent },
  // Matches the card's verdict tint, so the field is judged along with everything else.
  inputOk: { borderColor: colors.correct, backgroundColor: colors.correctSoft },
  inputBad: { borderColor: colors.incorrect, backgroundColor: colors.incorrectSoft },
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
  lockText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  clueBtn: { backgroundColor: colors.border },
  clueText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  disabled: { opacity: 0.4 },
  answerSlot: { height: 46, justifyContent: 'center' },
  retry: { color: colors.incorrect, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  answer: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  answerReading: { color: colors.ink, fontFamily: fonts.semibold, textDecorationLine: 'underline', textDecorationColor: colors.border },
  answerHint: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: 2, opacity: 0.8 },
})
