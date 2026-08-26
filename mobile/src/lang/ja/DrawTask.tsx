import { View, Text, StyleSheet } from 'react-native'
import type { DrawTask } from '@lib/tasks'
import { DrawCanvas } from '../../components/DrawCanvas'
import { VoweledText } from '../../components/VoweledText'
import { scoreWord } from '@lib/handwriting'
import type { TaskUI, TaskViewProps } from '../../components/tasks/types'
import type { DrawStroke } from '../types'
import { colors, fonts } from '../../theme'

/** Draw the word from its reading. Strokes are lifted to the session; graded on-device at lock-in. */
function DrawView({ task, answer, setAnswer, phase, score, onGiveUp }: TaskViewProps<DrawTask, DrawStroke[]>) {
  const revealed = phase === 'revealed'
  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        {/*
          The wrapping and shrink-to-fit are for the English fallback only. Applied to both, they
          scaled a short kana reading down too: fitting *two* lines into the box caps a single line
          at half its height, so the reading came out tiny for no reason.
        */}
        <Text
          style={[styles.reading, !task.reading && styles.readingEn]}
          numberOfLines={task.reading ? 1 : 2}
          adjustsFontSizeToFit={!task.reading}
        >
          {task.reading || task.meaning}
        </Text>
      </View>

      <View style={styles.canvasBox}>
        {/* The surface carries the verdict too — the card tinting around an untouched canvas read
            as though the drawing itself hadn't been judged. */}
        <DrawCanvas
          disabled={revealed}
          initialStrokes={answer}
          onStrokes={setAnswer}
          onNoClue={onGiveUp}
          status={revealed ? (score > 0 ? 'right' : 'wrong') : undefined}
        />
      </View>

      <View style={styles.answerSlot}>
        {revealed && (
          <View style={styles.answer}>
            <VoweledText text={task.word} style={styles.answerWord} />
            <Text style={styles.answerMeaning}>{task.meaning}</Text>
          </View>
        )}
      </View>
    </View>
  )
}

/** The draw practice task — JA's pack-contributed task module (recognizer-graded). */
export const drawTask: TaskUI<DrawTask, DrawStroke[]> = {
  emptyAnswer: () => [],
  hasAnswer: (a) => a.length > 0,
  View: DrawView,
  scrollable: false, // the canvas owns vertical drags
  overrideLabel: 'I think I got this one right!', // recognizer can misread a correct drawing…
  overrideWrongLabel: 'Wait I got this one wrong!', // …or misread a wrong one as correct
  // Every task shows the strip, so the card is the same height throughout a session. Drawing has no
  // words to hold, so its line is instructional rather than a reveal.
  revealHint: (phase) =>
    phase === 'revealed' ? 'The word and its meaning are above' : 'Draw the word, then lock in',
  resolve: (task, answer) => ({ phase: 'revealed', score: scoreWord(task.word, answer).correct ? 1 : -1 }),
}

const styles = StyleSheet.create({
  root: { width: '100%', flex: 1, alignItems: 'stretch' },
  /*
   * Fixed height. An English meaning can run to ~26 characters where a kana reading is three or four,
   * so left to itself the prompt wrapped to three lines and shoved the canvas down the card.
   */
  prompt: { height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  /*
   * The prompt is the kana reading when there is one and the English meaning when there isn't, so the
   * face follows the text rather than the field: brush for Japanese, the Latin body face for English.
   */
  // The prompt is a kana reading, so it stays on the OS gothic like the rest of the kana.
  reading: { color: colors.ink, fontSize: 28 },
  // Smaller, since English needs the width a kana reading doesn't.
  readingEn: { fontFamily: fonts.body, fontSize: 17, textAlign: 'center' },
  /*
   * Takes whatever the fixed rows leave, so the card is the same height whatever the task. Every
   * other row here is deliberately tight — the canvas is the task, so the space goes to it.
   */
  canvasBox: { flex: 1, minHeight: 220 },
  answerSlot: { height: 56, justifyContent: 'center', marginTop: 8 }, // reserved so the answer isn't covered
  answer: { alignItems: 'center', gap: 2 },
  // No family: VoweledText gives kanji runs the mincho face and leaves kana on the OS gothic.
  answerWord: { color: colors.ink, fontSize: 30 },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
})
