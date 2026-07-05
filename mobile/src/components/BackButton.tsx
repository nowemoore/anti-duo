import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from './Icon'
import { colors } from '../theme'

/** Unified back control across the app: a circled chevron. */
export function BackButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}
    >
      <Icon name="chevron-left" size={17} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pressed: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
})
