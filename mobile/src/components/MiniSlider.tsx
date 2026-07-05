import { useRef } from 'react'
import { View, PanResponder, StyleSheet } from 'react-native'
import { useScrollLock } from '../context/ScrollLockContext'
import { colors } from '../theme'

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  onComplete?: (v: number) => void
}

/**
 * A minimal slider with a small circular thumb — the native `@react-native-community/slider` thumb
 * renders as a large/oval shape we can't control, so this draws its own track + thumb.
 *
 * Position is derived from the touch's absolute `pageX` minus the track's measured left edge. Using
 * `nativeEvent.locationX` instead would jump around, because it's relative to whichever child view
 * (thumb, fill, track) happens to be under the finger rather than the track as a whole.
 */
export function MiniSlider({ value, min = 0, max = 3, step = 0.1, onChange, onComplete }: Props) {
  const wrapRef = useRef<View>(null)
  const geom = useRef({ left: 0, width: 0 })
  const lock = useScrollLock()
  const cfg = useRef({ min, max, step, onChange, onComplete, lock })
  cfg.current = { min, max, step, onChange, onComplete, lock }

  const remeasure = () => {
    wrapRef.current?.measureInWindow((x, _y, w) => {
      geom.current = { left: x, width: w }
    })
  }

  function apply(pageX: number, commit: boolean) {
    const { left, width } = geom.current
    if (width <= 0) return
    const c = cfg.current
    const f = Math.max(0, Math.min(1, (pageX - left) / width))
    let v = c.min + f * (c.max - c.min)
    v = Math.round(v / c.step) * c.step
    v = Math.max(c.min, Math.min(c.max, Math.round(v * 100) / 100))
    c.onChange(v)
    if (commit) c.onComplete?.(v)
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      // Once we own the drag, never yield it back to the surrounding ScrollView — otherwise any
      // vertical drift lets the ScrollView reclaim the gesture and the thumb stops following.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      // Measure fresh on grant (the panel may have scrolled since layout), then track pageX.
      onPanResponderGrant: (_e, g) => {
        cfg.current.lock(true)
        wrapRef.current?.measureInWindow((x, _y, w) => {
          geom.current = { left: x, width: w }
          apply(g.x0, false)
        })
      },
      onPanResponderMove: (_e, g) => apply(g.moveX, false),
      onPanResponderRelease: (_e, g) => {
        apply(g.moveX, true)
        cfg.current.lock(false)
      },
      onPanResponderTerminate: (_e, g) => {
        apply(g.moveX, true)
        cfg.current.lock(false)
      },
    }),
  ).current

  const frac = max > min ? (Math.max(min, Math.min(max, value)) - min) / (max - min) : 0

  return (
    <View ref={wrapRef} style={styles.wrap} onLayout={remeasure} {...pan.panHandlers}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${frac * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: `${frac * 100}%` }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 32, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 2 },
  thumb: {
    position: 'absolute',
    top: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: colors.accentInk,
  },
})
