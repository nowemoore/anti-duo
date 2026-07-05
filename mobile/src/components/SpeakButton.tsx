import * as Speech from 'expo-speech'
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Icon } from './Icon'
import { colors } from '../theme'

interface Props {
  /** What to pronounce — pass the kana reading so pronunciation is always correct. */
  text: string
  label?: string
  disabled?: boolean
  /** Smaller variant (option corners / inline). */
  small?: boolean
  style?: StyleProp<ViewStyle>
}

/** Speaks Japanese via the OS TTS (expo-speech) — no backend, nothing leaves the device. */
export function SpeakButton({ text, label, disabled, small, style }: Props) {
  const speak = () => {
    Speech.stop()
    Speech.speak(text, { language: 'ja-JP', rate: 0.95 })
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Play pronunciation'}
      disabled={disabled}
      onPress={speak}
      hitSlop={6}
      style={[styles.btn, small && styles.small, disabled && styles.disabled, style]}
    >
      <Icon name="volume-high" size={small ? 12 : 14} color={colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { width: 28, height: 28, borderRadius: 14 },
  disabled: { opacity: 0.35 },
})
