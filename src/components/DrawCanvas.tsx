import { useLayoutEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export type Point = { x: number; y: number }
export type Stroke = Point[]

function toPath(s: Stroke): string {
  if (!s.length) return ''
  return s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
}

/**
 * Font size that makes the tracing guide fill the canvas: bounded by the height, and by the width
 * shared between however many characters the word has. CJK glyphs are roughly square, so one
 * character's width ≈ its font size.
 */
function guideFontSize(word: string, width: number, height: number): number {
  const chars = Math.max(1, [...word].length)
  if (width <= 0 || height <= 0) return 0
  return Math.floor(Math.min(height * 0.94, (width * 0.96) / chars))
}

/**
 * Where the guide's baseline sits relative to the canvas centre, as a fraction of the font size.
 *
 * CJK ink spans roughly −0.88em (top) to +0.12em (bottom) around the baseline, so the optical centre
 * of a glyph is about 0.38em *above* it — push the baseline down by that much and the glyph lands in
 * the middle. Done in SVG rather than by centring a text box, whose line-box metrics differ per font
 * and leave kana (whose ink fills less of the em box than kanji) visibly off-centre.
 */
const GUIDE_BASELINE = 0.37

/**
 * Drawing surface: captures strokes as point arrays and renders them as SVG paths. Self-contained
 * (Undo / Clear). Reset it by changing its `key`. Reports the full stroke list via `onStrokes`,
 * which is what the recognizer grades.
 *
 * Pointer events rather than mouse + touch: one code path covers mouse, pen and finger, and
 * `setPointerCapture` keeps a stroke that wanders off the surface attached to it — the web
 * counterpart of the phone's "don't hand the gesture to the scroller" rule. `touch-action: none`
 * (in CSS) is what stops a finger drag from scrolling the page instead of drawing.
 */
export function DrawCanvas({
  disabled,
  onStrokes,
  onNoClue,
  initialStrokes,
  guide,
  status,
}: {
  disabled?: boolean
  onStrokes?: (strokes: Stroke[]) => void
  /** When set, shows a "No clue" button (gives up the current word). */
  onNoClue?: () => void
  /** Seeds the canvas on mount (to replay a previously-drawn answer). Change `key` to re-seed. */
  initialStrokes?: Stroke[]
  /**
   * Word rendered faintly behind the ink, to trace over. Used for characters the recognizer has no
   * reference pattern for, where the answer can't be graded but the strokes are still worth drawing.
   */
  guide?: string
  /** Tints the surface once an answer has been judged. Absent → the neutral surface. */
  status?: 'right' | 'wrong'
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => initialStrokes ?? [])
  const [current, setCurrent] = useState<Stroke>([])
  const currentRef = useRef<Stroke>([])
  const surfaceRef = useRef<HTMLDivElement>(null)
  // Measured so the tracing guide can be scaled to fill whatever space the canvas ended up with.
  const [size, setSize] = useState({ width: 0, height: 0 })
  const guideSize = guide ? guideFontSize(guide, size.width, size.height) : 0

  // The surface is flex-sized, so its box is only known after layout — and it changes with the
  // window. ResizeObserver keeps the guide in step without a re-render on every frame of a drag.
  useLayoutEffect(() => {
    const el = surfaceRef.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const commit = (next: Stroke[]) => {
    setStrokes(next)
    onStrokes?.(next)
  }

  /** Pointer position in the surface's own coordinates — what the recognizer expects. */
  const pointAt = (e: React.PointerEvent): Point => {
    const box = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const start = (e: React.PointerEvent) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pointAt(e)
    currentRef.current = [p]
    setCurrent([p])
  }

  const move = (e: React.PointerEvent) => {
    if (disabled || currentRef.current.length === 0) return
    currentRef.current = [...currentRef.current, pointAt(e)]
    setCurrent(currentRef.current)
  }

  const end = () => {
    const s = currentRef.current
    currentRef.current = []
    setCurrent([])
    // A tap with no travel isn't a stroke; dropping it keeps stray taps out of the recognizer.
    if (s.length > 1) commit([...strokes, s])
  }

  const empty = strokes.length === 0

  return (
    <div className="draw">
      <div className="draw-toolbar">
        {onNoClue && (
          <button type="button" className="draw-noclue" onClick={onNoClue} disabled={disabled}>
            <FontAwesomeIcon icon="skull" />
            No clue
          </button>
        )}
        <div className="draw-tools">
          <button
            type="button"
            className="draw-tool"
            onClick={() => commit(strokes.slice(0, -1))}
            disabled={disabled || empty}
          >
            <FontAwesomeIcon icon="rotate-left" />
            Undo
          </button>
          <button
            type="button"
            className="draw-tool"
            onClick={() => commit([])}
            disabled={disabled || empty}
          >
            <FontAwesomeIcon icon="trash-can" />
            Clear
          </button>
        </div>
      </div>

      <div
        ref={surfaceRef}
        className={`draw-surface${status ? ` ${status}` : ''}${disabled ? ' disabled' : ''}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <svg className="draw-ink" width="100%" height="100%">
          {/* Tracing guide, drawn first so it sits behind the ink. Hidden until the surface is
              measured, so it can't flash at the wrong size. */}
          {guide && guideSize > 0 && (
            <text
              className="draw-guide"
              x={size.width / 2}
              y={size.height / 2 + guideSize * GUIDE_BASELINE}
              fontSize={guideSize}
              textAnchor="middle"
            >
              {guide}
            </text>
          )}
          {[...strokes, current].map((s, i) =>
            s.length ? (
              <path
                key={i}
                d={toPath(s)}
                fill="none"
                stroke="currentColor"
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null,
          )}
        </svg>
      </div>
    </div>
  )
}
