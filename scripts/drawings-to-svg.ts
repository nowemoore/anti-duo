// Renders saved handwriting back into viewable images — `npm run drawings:svg -- <input> [outDir]`.
//
// The `drawings` table stores each answer as stroke paths, not as a picture: `strokes` is
// [[{x,y}, …], …] in the canvas's own pixel space (see DrawCanvas — the points come straight from
// locationX/locationY). The canvas is flex-sized, so the coordinate range differs per device and
// there is no fixed viewport to replay into. This fits each drawing to its own bounding box
// instead, which reproduces the shape faithfully at any size.
//
// Input: JSON exported from the Supabase table editor. Accepts a single row, an array of rows, or
// a bare strokes array. `strokes` may be a nested array or a JSON string (as CSV exports produce).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Rendered box, in px. Drawings are scaled to fit inside this, keeping their aspect ratio. */
const SIZE = 256
const PADDING = 12
const STROKE_WIDTH = 6

interface Point {
  x: number
  y: number
}

interface DrawingRow {
  id?: string
  word?: string | null
  strokes: unknown
  assessed_correct?: boolean
  override_correct?: boolean | null
  created_at?: string
}

/** Accepts {x,y} objects or [x,y] pairs; anything else in the array is skipped. */
function toPoints(raw: unknown): Point[] {
  if (!Array.isArray(raw)) return []
  const out: Point[] = []
  for (const p of raw) {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
      out.push({ x: p[0], y: p[1] })
    } else if (p && typeof p === 'object') {
      const { x, y } = p as Point
      if (typeof x === 'number' && typeof y === 'number') out.push({ x, y })
    }
  }
  return out
}

/** jsonb comes back as an array; a CSV export gives the same thing as a string. */
function toStrokes(raw: unknown): Point[][] {
  const value = typeof raw === 'string' ? safeParse(raw) : raw
  if (!Array.isArray(value)) return []
  return value.map(toPoints).filter((s) => s.length > 0)
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/**
 * Fit the strokes into a SIZE box: uniform scale about the bounding box's centre, so proportions
 * are preserved and the drawing is centred whatever the original canvas measured.
 */
function fit(strokes: Point[][]): Point[][] {
  const pts = strokes.flat()
  if (pts.length === 0) return strokes
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const span = Math.max(maxX - minX, maxY - minY)
  // A single dot has zero span — keep it at 1:1 rather than dividing by zero.
  const scale = span > 0 ? (SIZE - PADDING * 2) / span : 1
  const offX = (SIZE - (maxX - minX) * scale) / 2
  const offY = (SIZE - (maxY - minY) * scale) / 2
  return strokes.map((s) =>
    s.map((p) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY })),
  )
}

function toSvg(strokes: Point[][], caption?: string): string {
  const paths = fit(strokes)
    .map((s) => {
      // A one-point stroke draws nothing as a polyline; round-capped zero-length line = a dot.
      const d =
        s.length === 1
          ? `M ${s[0].x.toFixed(2)} ${s[0].y.toFixed(2)} L ${s[0].x.toFixed(2)} ${s[0].y.toFixed(2)}`
          : s.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
      return `  <path d="${d}" />`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" fill="#2f2f2f" />
  <g fill="none" stroke="#edf1ef" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">
${paths}
  </g>${caption ? `\n  <title>${caption}</title>` : ''}
</svg>
`
}

/** Filesystem-safe, stable, and readable: word + verdict + short id. */
function fileNameFor(row: DrawingRow, i: number): string {
  const word = (row.word ?? 'drawing').replace(/[^\p{L}\p{N}]/gu, '') || 'drawing'
  const verdict =
    row.override_correct != null
      ? row.override_correct
        ? 'ok-overridden'
        : 'no-overridden'
      : row.assessed_correct == null
        ? 'unknown'
        : row.assessed_correct
          ? 'ok'
          : 'no'
  const id = row.id ? String(row.id).slice(0, 8) : String(i + 1).padStart(3, '0')
  return `${word}-${verdict}-${id}.svg`
}

function main() {
  const [input, outDir = 'drawings-svg'] = process.argv.slice(2)
  if (!input) {
    console.error('Usage: npm run drawings:svg -- <exported.json> [outDir]')
    process.exit(1)
  }

  const parsed = safeParse(readFileSync(input, 'utf8'))
  if (parsed == null) {
    console.error(`Could not parse ${basename(input)} as JSON.`)
    process.exit(1)
  }

  // A bare strokes array (someone copied just the cell) vs. row objects from a table export.
  const rows: DrawingRow[] = Array.isArray(parsed)
    ? parsed.length > 0 && Array.isArray(parsed[0])
      ? [{ strokes: parsed }]
      : (parsed as DrawingRow[])
    : [parsed as DrawingRow]

  mkdirSync(outDir, { recursive: true })

  let written = 0
  let empty = 0
  for (const [i, row] of rows.entries()) {
    const strokes = toStrokes(row?.strokes)
    if (strokes.length === 0) {
      empty++
      continue
    }
    const caption = [row.word, row.created_at].filter(Boolean).join(' · ')
    writeFileSync(join(outDir, fileNameFor(row, i)), toSvg(strokes, caption), 'utf8')
    written++
  }

  console.log(`wrote ${written} svg${written === 1 ? '' : 's'} to ${outDir}/`)
  // Rows with no usable strokes are reported rather than passed over silently.
  if (empty) console.log(`skipped ${empty} row${empty === 1 ? '' : 's'} with no stroke data`)
}

main()
