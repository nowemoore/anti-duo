import { type ReactNode } from 'react'
import { View, StyleSheet } from 'react-native'
import { PagerChevron } from '../PagerChevron'
import { useStyles } from '../../hooks/theme'

interface Props {
  answered: boolean
  canCheck: boolean
  onCheck: () => void
  onContinue: () => void
  /** Optional control on the far left (e.g. "No clue"). */
  leftExtra?: ReactNode
}

/** Shared quiz footer: check button + continue chevron (keyboard shortcuts dropped on mobile). */
export function QuizActions({ answered, canCheck, onCheck, onContinue, leftExtra }: Props) {
  const styles = useStyles(makeStyles)
  return (
    <View style={styles.row}>
      <View style={styles.left}>{leftExtra}</View>
      <View style={styles.right}>
        <PagerChevron dir="next" icon="check" label="Check" disabled={answered || !canCheck} onPress={onCheck} />
        <PagerChevron dir="next" label="Continue" disabled={!answered} onPress={onContinue} />
      </View>
    </View>
  )
}

const makeStyles = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  right: { flexDirection: 'row', gap: 10 },
})
