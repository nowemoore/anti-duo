import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

/** How long a verdict takes to settle. Long enough to read as a change of state, not a flash. */
export const VERDICT_MS = 280

/**
 * A 0→1 value that eases in when a question is answered and back out when it isn't.
 *
 * Colour cannot be driven natively — `useNativeDriver` only handles transform and opacity — so this
 * runs on the JS driver. That's fine for a handful of chips easing once per question; it would not be
 * for anything per-frame or per-gesture.
 */
export function useVerdictFade(on: boolean, duration = VERDICT_MS): Animated.Value {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current
  useEffect(() => {
    Animated.timing(v, {
      toValue: on ? 1 : 0,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [on, duration, v])
  return v
}

/** Interpolates one colour into another across the fade. Both ends must be real colour strings. */
export function fadeColor(v: Animated.Value, from: string, to: string): Animated.AnimatedInterpolation<string> {
  return v.interpolate({ inputRange: [0, 1], outputRange: [from, to] })
}
