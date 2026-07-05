import { type ReactNode } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { Icon } from '../Icon'
import { colors } from '../../theme'

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
  return (
    <View style={styles.row}>
      <View style={styles.left}>{leftExtra}</View>
      <View style={styles.right}>
        <Pressable
          accessibilityLabel="Check"
          disabled={answered || !canCheck}
          onPress={onCheck}
          style={[styles.chevron, styles.check, (answered || !canCheck) && styles.disabled]}
        >
          <Icon name="check" size={18} color={colors.onAccent} />
        </Pressable>
        <Pressable
          accessibilityLabel="Continue"
          disabled={!answered}
          onPress={onContinue}
          style={[styles.chevron, styles.next, !answered && styles.disabled]}
        >
          <Icon name="chevron-right" size={18} color={colors.onAccent} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  right: { flexDirection: 'row', gap: 10 },
  chevron: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  check: { backgroundColor: colors.accent },
  next: { backgroundColor: colors.accent },
  disabled: { opacity: 0.3 },
})
