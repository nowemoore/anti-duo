import { View, Text, StyleSheet } from 'react-native'
import type { DrawKanjiTask } from '@lib/tasks'
import { DrawCanvas } from '../DrawCanvas'
import type { RawStroke } from '../../lib/handwriting'
import { colors, fonts } from '../../theme'

interface Props {
  task: DrawKanjiTask
  revealed: boolean
  strokes: RawStroke[]
  onStrokes: (s: RawStroke[]) => void
  onGiveUp: () => void
}

/** T4: draw the word from its reading. Strokes are lifted to the session; graded at lock-in. */
export function DrawKanjiTaskView({ task, revealed, strokes, onStrokes, onGiveUp }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.prompt}>
        <Text style={styles.reading}>{task.reading || task.meaning}</Text>
      </View>

      <View style={styles.canvasBox}>
        <DrawCanvas disabled={revealed} initialStrokes={strokes} onStrokes={onStrokes} onNoClue={onGiveUp} />
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

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'stretch' },
  prompt: { alignItems: 'center', gap: 2, marginBottom: 12 },
  label: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  reading: { color: colors.ink, fontFamily: fonts.body, fontSize: 28 },
  canvasBox: { height: 260 },
  answerSlot: { height: 70, justifyContent: 'center', marginTop: 12 }, // reserved so the answer isn't covered
  answer: { alignItems: 'center', gap: 2 },
  answerWord: { color: colors.ink, fontSize: 42 },
  answerMeaning: { color: colors.muted, fontFamily: fonts.body, fontSize: 14 },
})
