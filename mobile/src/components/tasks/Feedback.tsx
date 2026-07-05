import { View, Text, StyleSheet } from 'react-native'
import { Icon } from '../Icon'
import { colors, fonts } from '../../theme'

export function Feedback({ correct, detail }: { correct: boolean; detail?: string }) {
  return (
    <View style={[styles.pill, correct ? styles.ok : styles.bad]}>
      <Icon
        name={correct ? 'circle-check' : 'circle-xmark'}
        size={15}
        color={correct ? colors.correct : colors.incorrect}
      />
      <Text style={[styles.label, { color: correct ? colors.correct : colors.incorrect }]}>
        {correct ? 'Correct!' : 'Not quite.'}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    flexShrink: 1,
  },
  ok: { backgroundColor: colors.correctSoft },
  bad: { backgroundColor: colors.incorrectSoft },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
  detail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, flexShrink: 1 },
})
