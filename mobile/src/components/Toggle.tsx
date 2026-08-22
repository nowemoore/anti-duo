import { Switch } from 'react-native'
import { useColors } from '../hooks/theme'

/**
 * An on/off switch — the platform's own (`UISwitch` on iOS), tinted to the palette.
 *
 * Was a hand-drawn track and knob. The system switch is the one control every user already knows
 * the feel of (the drag-to-flick, the haptic), and none of that survives a re-implementation.
 */
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
  /** Not shown — the switch is unlabelled, so this names it for screen readers. */
  label?: string
}) {
  const colors = useColors()
  return (
    <Switch
      value={checked}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={label}
      trackColor={{ false: colors.border, true: colors.accent }}
      // iOS paints the off-track white underneath `trackColor.false` unless this matches it.
      ios_backgroundColor={colors.border}
      // The nested variant sits in a tighter row; the switch has no size prop, so scale it.
      style={small ? { transform: [{ scale: 0.82 }] } : undefined}
    />
  )
}
