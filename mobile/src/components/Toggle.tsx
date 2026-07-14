import { Pressable, View, StyleSheet } from 'react-native'
import { type Palette } from '../theme'
import { useStyles } from '../hooks/theme'

/** A small slider switch (align the knob to start/end instead of translate math). */
export function Toggle({
  checked,
  onChange,
  disabled,
  small,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  small?: boolean
  label?: string
}) {
  const styles = useStyles(makeStyles)
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[
        styles.track,
        small && styles.trackSmall,
        { alignItems: checked ? 'flex-end' : 'flex-start' },
        checked && (small ? styles.onSmall : styles.on),
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.knob, small && styles.knobSmall]} />
    </Pressable>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  track: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.border, padding: 3, justifyContent: 'center' },
  trackSmall: { width: 40, height: 23, borderRadius: 12 },
  on: { backgroundColor: colors.accent },
  onSmall: { backgroundColor: colors.accentInk },
  disabled: { opacity: 0.4 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  knobSmall: { width: 17, height: 17, borderRadius: 8.5 },
})
