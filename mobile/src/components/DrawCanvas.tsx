import { useRef, useState } from 'react'
import { View, Text, Pressable, PanResponder, StyleSheet } from 'react-native'
import Svg, { Path, Text as SvgText } from 'react-native-svg'
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
 * Where the text baseline sits relative to the canvas centre, as a fraction of the font size.
 *
 * CJK ink spans roughly −0.88em (top) to +0.12em (bottom) around the baseline, so the optical centre
 * of a glyph is about 0.38em *above* its baseline — push the baseline down by that much and the
 * glyph lands in the middle. Doing this in SVG rather than with a centred RN <Text> because the
 * text-box approach depends on font line-box metrics, which differ per platform and left kana (whose
 * ink fills less of the em box than kanji) visibly off-centre.
 */
const GUIDE_BASELINE = 0.37

/**
 * Finger-drawing surface: captures strokes as point arrays and renders them with react-native-svg.
 * Self-contained (Undo/Clear). Reset by changing its `key`. Reports stroke count via onChange, and
 * the full stroke list via onStrokes (for a future recognizer).
 */
export function DrawCanvas({
  disabled,
  onChange,
  onStrokes,
  onDrawingChange,
  onNoClue,
  initialStrokes,
  guide,
  status,
}: {
  disabled?: boolean
  onChange?: (count: number) => void
  onStrokes?: (strokes: Stroke[]) => void
  /**
   * Fires true the moment a finger lands on the surface and false when it lifts.
   *
   * A scrolling ancestor needs this: a horizontal pager will cancel a child's touch and scroll
   * instead as soon as the finger moves sideways, which eats horizontal strokes (こ, に, エ, ー).
   * Refusing the JS responder handover isn't enough, because native scrolling doesn't go through
   * that negotiation — the parent has to actually switch scrolling off. Reported on touch-down,
   * before any movement, so the parent can react before the first move event.
   */
  onDrawingChange?: (drawing: boolean) => void
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
  /** Tints the drawing surface once an answer has been judged. Absent → the neutral surface. */
  status?: 'right' | 'wrong'
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
      // See the note on the live responder below.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
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
    /*
     * Once drawing has started, keep the gesture no matter who asks for it.
     *
     * A scrolling ancestor (the character pager is a horizontal FlatList) requests the responder as
     * soon as the finger travels sideways, and the default answer is *yes* — which terminated the
     * stroke and scrolled the page instead. Since many kana strokes are horizontal (こ, に, エ, ー),
     * that made the canvas effectively undrawable. Refusing the request keeps every stroke that
     * begins on the canvas; `onShouldBlockNativeResponder` does the same for Android's native
     * scroll, which doesn't go through the JS responder negotiation.
     */
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
      currentRef.current = [p]
      setCurrent([p])
      onDrawingChange?.(true)
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
      onDrawingChange?.(false)
    },
    onPanResponderTerminate: () => {
      currentRef.current = []
      setCurrent([])
      onDrawingChange?.(false)
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
        style={[
          styles.surface,
          status === 'right' && styles.surfaceRight,
          status === 'wrong' && styles.surfaceWrong,
        ]}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setSurface({ width, height })
        }}
        {...pan.current.panHandlers}
      >
        {/* width/height 100% are required on web — without them react-native-svg falls back to the
            SVG default 150px height, so strokes below ~the top half never render. */}
        <Svg width="100%" height="100%" pointerEvents="none" style={StyleSheet.absoluteFill}>
          {/* Tracing guide, drawn first so it sits behind the ink. The whole Svg is
              pointerEvents="none" and the pan handlers live on the parent, so it can't intercept a
              stroke. Hidden until the canvas is measured, so it can't flash at the wrong size. */}
          {guide && guideSize > 0 && (
            <SvgText
              x={surface.width / 2}
              y={surface.height / 2 + guideSize * GUIDE_BASELINE}
              fontSize={guideSize}
              fontFamily={fonts.brush}
              textAnchor="middle"
              fill={colors.ink}
              opacity={0.14}
            >
              {guide}
            </SvgText>
          )}
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
  // Verdict tints. The fills stay soft so the learner's own strokes remain the clearest thing on
  // the surface — the border carries most of the signal.
  surfaceRight: { borderColor: colors.correct, borderWidth: 2, backgroundColor: colors.correctSoft },
  surfaceWrong: { borderColor: colors.incorrect, borderWidth: 2, backgroundColor: colors.incorrectSoft },
})
