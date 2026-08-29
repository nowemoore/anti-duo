import Slider from '@react-native-community/slider'
import { useColors } from '../hooks/theme'

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  onComplete?: (v: number) => void
}

/**
 * The task-weight slider: the platform's own control (`UISlider` on iOS), tinted to the palette.
 *
 * This was a hand-drawn track + thumb over a PanResponder for a while, on the grounds that the
 * native thumb couldn't be styled. It can't — but the native thumb *is* the iOS thumb, and drawing
 * our own also meant re-implementing gesture arbitration against the surrounding ScrollView, which
 * is precisely the part the platform gets right for free.
 */
export function MiniSlider({ value, min = 0, max = 3, step = 0.1, onChange, onComplete }: Props) {
  const colors = useColors()
  return (
    <Slider
      value={value}
      minimumValue={min}
      maximumValue={max}
      step={step}
      onValueChange={onChange}
      onSlidingComplete={onComplete}
      // The filled part of a track is a progress bar by another name, so it takes the lavender.
      minimumTrackTintColor={colors.highlight}
      maximumTrackTintColor={colors.border}
      // iOS ignores this (its thumb is always the system white puck); Android honours it.
      thumbTintColor={colors.accentInk}
      style={{ height: 36 }}
    />
  )
}
