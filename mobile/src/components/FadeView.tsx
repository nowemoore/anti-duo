import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, type StyleProp, type ViewStyle } from 'react-native'

/**
 * Fades (and lifts slightly) its children in on mount. Give it a `key` that changes on
 * navigation (tab or phase) so each view transition animates instead of snapping in.
 */
export function FadeView({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 220, useNativeDriver: true }).start()
  }, [t])
  return (
    <Animated.View
      style={[
        style,
        { opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  )
}
