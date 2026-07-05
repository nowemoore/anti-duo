import { useRef, useState } from 'react'
import { View, Text, Pressable, PanResponder, StyleSheet } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { Icon } from './Icon'
import { colors, fonts, radius, spacing } from '../theme'

export type Point = { x: number; y: number }
export type Stroke = Point[]

function toPath(s: Stroke): string {
  if (!s.length) return ''
  return s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

/**
 * Finger-drawing surface: captures strokes as point arrays and renders them with react-native-svg.
 * Self-contained (Undo/Clear). Reset by changing its `key`. Reports stroke count via onChange, and
 * the full stroke list via onStrokes (for a future recognizer).
 */
export function DrawCanvas({
  disabled,
  onChange,
  onStrokes,
  onNoClue,
  initialStrokes,
}: {
  disabled?: boolean
  onChange?: (count: number) => void
  onStrokes?: (strokes: Stroke[]) => void
  /** When set, shows a "No clue" button (gives up the current word). */
  onNoClue?: () => void
  /** Seeds the canvas on mount (to replay a previously-drawn answer). Change `key` to re-seed. */
  initialStrokes?: Stroke[]
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => initialStrokes ?? [])
  const [current, setCurrent] = useState<Stroke>([])
  const currentRef = useRef<Stroke>([])

  const commit = (next: Stroke[]) => {
    setStrokes(next)
    onChange?.(next.length)
    onStrokes?.(next)
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
        currentRef.current = [p]
        setCurrent([p])
      },
      onPanResponderMove: (e) => {
        const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
        currentRef.current = [...currentRef.current, p]
        setCurrent(currentRef.current)
      },
      onPanResponderRelease: () => {
        const s = currentRef.current
        currentRef.current = []
        setCurrent([])
        if (s.length > 1) commit([...strokes, s])
      },
      onPanResponderTerminate: () => {
        currentRef.current = []
        setCurrent([])
      },
    }),
  )
  // Keep the responder closure's `strokes` current.
  pan.current = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: (e) => {
      const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
      currentRef.current = [p]
      setCurrent([p])
    },
    onPanResponderMove: (e) => {
      const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
      currentRef.current = [...currentRef.current, p]
      setCurrent(currentRef.current)
    },
    onPanResponderRelease: () => {
      const s = currentRef.current
      currentRef.current = []
      setCurrent([])
      if (s.length > 1) commit([...strokes, s])
    },
    onPanResponderTerminate: () => {
      currentRef.current = []
      setCurrent([])
    },
  })

  const undo = () => commit(strokes.slice(0, -1))
  const clear = () => commit([])
  const empty = strokes.length === 0

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        {onNoClue && (
          <Pressable onPress={onNoClue} disabled={disabled} style={[styles.noclue, disabled && styles.toolOff]}>
            <Icon name="skull" size={12} color={colors.muted} />
            <Text style={styles.noclueText}>No clue</Text>
          </Pressable>
        )}
        <View style={styles.toolGroup}>
          <Pressable onPress={undo} disabled={disabled || empty} style={[styles.tool, (disabled || empty) && styles.toolOff]}>
            <Icon name="rotate-left" size={12} color={colors.accentInk} />
            <Text style={styles.toolText}>Undo</Text>
          </Pressable>
          <Pressable onPress={clear} disabled={disabled || empty} style={[styles.tool, (disabled || empty) && styles.toolOff]}>
            <Icon name="trash-can" size={12} color={colors.accentInk} />
            <Text style={styles.toolText}>Clear</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.surface} {...pan.current.panHandlers}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          {strokes.map((s, i) => (
            <Path key={i} d={toPath(s)} stroke={colors.ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {current.length > 0 && (
            <Path d={toPath(current)} stroke={colors.ink} strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.sm },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  toolGroup: { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  toolOff: { opacity: 0.35 },
  toolText: { color: colors.accentInk, fontFamily: fonts.medium, fontSize: 13 },
  noclue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  noclueText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
  surface: {
    flex: 1,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
})
