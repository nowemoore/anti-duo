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
 * Font size that makes the tracing guide fill the canvas: bounded by the height, and by the width
 * shared between however many characters the word has.
 *
 * Computed rather than left to `adjustsFontSizeToFit`, which only ever shrinks from a fixed starting
 * size (so a single kanji stayed small on a tall canvas) and is a no-op on react-native-web.
 * CJK glyphs are roughly square, so one character's width ≈ its font size.
 */
function guideFontSize(word: string, width: number, height: number): number {
  const chars = Math.max(1, [...word].length)
  if (width <= 0 || height <= 0) return 0
  return Math.floor(Math.min(height * 0.94, (width * 0.96) / chars))
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
  guide,
}: {
  disabled?: boolean
  onChange?: (count: number) => void
  onStrokes?: (strokes: Stroke[]) => void
  /** When set, shows a "No clue" button (gives up the current word). */
  onNoClue?: () => void
  /** Seeds the canvas on mount (to replay a previously-drawn answer). Change `key` to re-seed. */
  initialStrokes?: Stroke[]
  /**
   * Word rendered faintly behind the ink, to trace over. Used for characters the on-device
   * recognizer has no reference pattern for, where the answer can't be graded but the strokes are
   * still worth collecting.
   */
  guide?: string
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => initialStrokes ?? [])
  const [current, setCurrent] = useState<Stroke>([])
  const currentRef = useRef<Stroke>([])
  // Measured so the tracing guide can be scaled to fill whatever space the canvas ended up with.
  const [surface, setSurface] = useState({ width: 0, height: 0 })
  const guideSize = guide ? guideFontSize(guide, surface.width, surface.height) : 0

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

      <View
        style={styles.surface}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setSurface({ width, height })
        }}
        {...pan.current.panHandlers}
      >
        {/* Tracing guide, behind the ink. Rendered before the Svg and non-interactive, and the pan
            handlers live on this parent, so it can't intercept a stroke. Hidden until the canvas has
            been measured, so it can't flash at the wrong size. */}
        {guide && guideSize > 0 ? (
          <View pointerEvents="none" style={styles.guideWrap}>
            <Text
              numberOfLines={1}
              // lineHeight === fontSize keeps the text box the height of the glyphs, so the flex
              // centering above actually centres what you see rather than a taller padded box.
              style={[styles.guideText, { fontSize: guideSize, lineHeight: guideSize }]}
            >
              {guide}
            </Text>
          </View>
        ) : null}
        {/* width/height 100% are required on web — without them react-native-svg falls back to the
            SVG default 150px height, so strokes below ~the top half never render. */}
        <Svg width="100%" height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}>
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
  // Faint enough to trace over without competing with the learner's own strokes. No padding here —
  // the fill margin is baked into guideFontSize so the glyph can be centred on the whole surface.
  guideWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  guideText: {
    color: colors.ink,
    opacity: 0.14,
    textAlign: 'center',
    // Android adds vertical font padding that pushes the glyph off-centre; the other platforms ignore this.
    includeFontPadding: false,
  },
})
