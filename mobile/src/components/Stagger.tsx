import { Children, isValidElement, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'

/** How far apart two neighbours start, and how long each one takes. */
const STEP_MS = 26
const ITEM_MS = 260
/** Total wave length is capped, so a 200-cell chart doesn't take ten seconds to appear. */
const MAX_WAVE_MS = 520

/**
 * One animation driving a whole run of items, rather than one per item.
 *
 * A `count`-length list gets a single 0→1 value; each item reads a slice of it. That keeps a
 * 200-cell kana chart to one native-driven timer instead of two hundred, and means the stagger costs
 * the same whether it's three cards or the whole board.
 */
export function useStagger(count: number): Animated.Value {
  const t = useRef(new Animated.Value(0)).current
  useEffect(() => {
    t.setValue(0)
    Animated.timing(t, {
      toValue: 1,
      duration: ITEM_MS + Math.min(MAX_WAVE_MS, STEP_MS * Math.max(0, count - 1)),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [t, count])
  return t
}

/**
 * One ready-made style per item, built once for a given count.
 *
 * Memoised deliberately: `interpolate` allocates a node that attaches to the native driver, so
 * rebuilding these inline on every render — and these grids re-render whenever progress changes —
 * churns through animated nodes and is what makes a large board stutter. Opacity and transform only,
 * so the whole thing stays native-driven; anything colour-based would drop it back to JS.
 */
export function useStaggerStyles(t: Animated.Value, count: number) {
  return useMemo(() => {
    const wave = ITEM_MS + Math.min(MAX_WAVE_MS, STEP_MS * Math.max(0, count - 1))
    return Array.from({ length: count }, (_, i) => {
      const start = Math.min(0.999, (i * STEP_MS) / wave)
      const end = Math.min(1, start + ITEM_MS / wave)
      const range = { inputRange: [start, end], extrapolate: 'clamp' as const }
      return {
        opacity: t.interpolate({ ...range, outputRange: [0, 1] }),
        transform: [{ translateY: t.interpolate({ ...range, outputRange: [10, 0] }) }],
      }
    })
  }, [t, count])
}

/**
 * Staggers its direct children in on mount. For a handful of sibling blocks — a column of cards, a
 * page's sections. Grids with hundreds of cells should use {@link useStagger} and
 * {@link useStaggerStyles} directly rather than wrapping every cell in another view.
 */
export function Stagger({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement)
  const t = useStagger(items.length)
  const anim = useStaggerStyles(t, items.length)
  return (
    <>
      {items.map((child, i) => (
        <Animated.View key={child.key ?? i} style={[style, anim[i]]}>
          {child}
        </Animated.View>
      ))}
    </>
  )
}
