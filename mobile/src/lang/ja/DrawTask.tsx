import { View, Text, StyleSheet } from 'react-native'
import type { DrawTask } from '@lib/tasks'
import { DrawCanvas } from '../../components/DrawCanvas'
import { scoreWord } from './handwriting'
import type { TaskUI, TaskViewProps } from '../../components/tasks/types'
import type { DrawStroke } from '../types'
import { colors, fonts } from '../../theme'

/** Draw the word from its reading. Strokes are lifted to the session; graded on-device at lock-in. */
function DrawView({ task, answer, setAnswer, phase, onGiveUp }: TaskViewProps<DrawTask, DrawStroke[]>) {
  const revealed = phase === 'revealed'
  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        <Text style={styles.reading}>{task.reading || task.meaning}</Text>
      </View>

      <View style={styles.canvasBox}>
        <DrawCanvas disabled={revealed} initialStrokes={answer} onStrokes={setAnswer} onNoClue={onGiveUp} />
      </View>

      <View style={styles.answerSlot}>
        {revealed && (
          <View style={styles.answer}>
            <Text style={styles.answerWord}>{task.word}</Text>
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
  overrideLabel: 'I think I got this one right', // recognizer can misread a correct drawing
  // no revealHint → the session renders no bottom reveal strip for drawing (the canvas owns the space)
  resolve: (task, answer) => ({ phase: 'revealed', score: scoreWord(task.word, answer).correct ? 1 : -1 }),
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'stretch' },
  prompt: { alignItems: 'center', gap: 2, marginBottom: 12 },
  reading: { color: colors.ink, fontFamily: fonts.body, fontSize: 28 },
  canvasBox: { height: 260 },
  answerSlot: { height: 70, justifyContent: 'center', marginTop: 12 }, // reserved so the answer isn't covered
  answer: { alignItems: 'center', gap: 2 },
  answerWord: { color: colors.ink, fontSize: 30 },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
})
