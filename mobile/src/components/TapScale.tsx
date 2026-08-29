import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** How far a pressed control shrinks, and how much it dims. Small on purpose — felt, not watched. */
const SCALE = 0.04
const DIM = 0.12
/** Asymmetric by design: the press must feel instant, the release can settle. */
const IN_MS = 90
const OUT_MS = 160

/**
 * The app-wide tap feel: a slight scale-down and dim while a control is held.
 *
 * Runs on the UI thread via Reanimated, so it stays smooth even while JS is busy grading an answer
 * — which is exactly when a button gets pressed. Returns the animated style plus the two handlers
 * to spread onto any pressable that can't use {@link TapScale} directly (one that already needs a
 * function-form `style`, say).
 *
 * No haptics: a light impact on every press was tried and is far too much when the app's whole
 * interaction is tapping through cards one after another.
 *
 * `base` is the opacity the control already wanted — a disabled button's dim, typically. The press
 * dim multiplies into it rather than replacing it: the animated style is applied last, so writing a
 * bare `opacity` here would silently override every `disabled && styles.off` in the app.
 */
export function usePressScale(base = 1, dim = true) {
  const press = useSharedValue(0)
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * SCALE }],
    // `dim: false` for anything wrapping a GlassView: animating opacity over the Liquid Glass
    // material invalidates it, and the card renders as a flat white slab that never recovers.
    opacity: dim ? base * (1 - press.value * DIM) : base,
  }))
  return {
    style,
    onPressIn: () => {
      press.value = withTiming(1, { duration: IN_MS })
    },
    onPressOut: () => {
      press.value = withTiming(0, { duration: OUT_MS })
    },
  }
}

/**
 * Drop-in replacement for `Pressable` that adds the standard tap bump. Same props, except `style`
 * must be a plain style rather than the function form — the pressed state is expressed by the
 * animation, so a `({ pressed }) => …` style would be fighting it.
 *
 * Pass `dim={false}` when the control contains glass: the scale still reads as a press, and the
 * opacity animation that would otherwise ride along breaks the material underneath it.
 *
 * Deliberately *not* used for grid cells (the kana chart, the kanji mosaic): those run to hundreds
 * of nodes on one screen, and each instance costs a shared value and an animated style.
 */
export function TapScale({
  style,
  onPressIn,
  onPressOut,
  children,
  dim = true,
  ...props
}: Omit<React.ComponentProps<typeof Pressable>, 'style'> & {
  style?: StyleProp<ViewStyle>
  /** False for controls containing a GlassView — see the note above. */
  dim?: boolean
}) {
  // Lift any opacity out of the incoming style so the animation can fold it in instead of winning.
  const flat = StyleSheet.flatten(style) ?? {}
  const bump = usePressScale(typeof flat.opacity === 'number' ? flat.opacity : 1, dim)
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        bump.onPressIn()
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        bump.onPressOut()
        onPressOut?.(e)
      }}
      style={[style, bump.style]}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  )
}
