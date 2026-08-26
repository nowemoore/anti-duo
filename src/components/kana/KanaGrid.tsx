import { chartRomaji, type ChartSection } from '../../lib/kana'

/** How a cell reads: never opened, or studied. The fill within `studied` is a ramp — see `fillOf`. */
export type CellState = 'new' | 'studied'

/** Alpha a just-studied cell carries, so it still reads as coloured rather than empty. */
const FILL_FLOOR = 0.18

/**
 * One block of the kana chart. Used both for the small read-only reference behind the help button
 * and for the large clickable chart in the Learn kana section, so the two can never fall out of
 * step visually.
 */
export function KanaGrid({
  section,
  size = 'small',
  flip = false,
  stateOf,
  fillOf,
  onSelect,
}: {
  section: ChartSection
  size?: 'small' | 'large'
  /**
   * Transpose before rendering, putting consonants across the x-axis and vowels down the y-axis.
   * `false` keeps the stored layout, so vowels run across the columns and each row is one consonant
   * group — the arrangement the Learn kana charts use.
   */
  flip?: boolean
  /** Shading per character. Omitted → every cell renders plain. */
  stateOf?: (char: string) => CellState
  /**
   * How solid a studied cell is, 0..1. The chart then reads as a map of how far along the script is,
   * rather than a binary opened/not-opened. Omitted → studied cells render at full strength.
   */
  fillOf?: (char: string) => number
  onSelect?: (char: string) => void
}) {
  const rows = flip ? transpose(section.rows) : section.rows
  const cols = Math.max(...rows.map((r) => r.length))
  const large = size === 'large'
  const cell = large ? (section.wide ? '3.1rem' : '2.6rem') : section.wide ? '2.4rem' : '1.8rem'

  return (
    <div
      className={`kana-grid${large ? ' large' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, ${cell})` }}
    >
      {rows.flat().map((char, i) => {
        if (!char) return <div key={i} className="kana-cell empty" aria-hidden="true" />

        const state = stateOf?.(char) ?? 'studied'
        // A studied cell's alpha tracks mastery, so the chart is a map of how far along you are.
        const fill =
          state === 'studied' && fillOf
            ? FILL_FLOOR + (1 - FILL_FLOOR) * Math.min(1, Math.max(0, fillOf(char)))
            : undefined
        const style =
          fill != null
            ? { background: `color-mix(in srgb, var(--accent) ${(fill * 100).toFixed(1)}%, transparent)` }
            : undefined
        const className = `kana-cell${state === 'new' ? ' new' : ''}`
        const body = (
          <>
            <span className="kana">{char}</span>
            <span className="romaji">{chartRomaji(char)}</span>
          </>
        )

        return onSelect ? (
          <button
            key={i}
            type="button"
            className={className}
            style={style}
            aria-label={`${char}, ${chartRomaji(char)}`}
            onClick={() => onSelect(char)}
          >
            {body}
          </button>
        ) : (
          <div key={i} className={className} style={style}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

function transpose(rows: (string | null)[][]): (string | null)[][] {
  const cols = Math.max(...rows.map((r) => r.length))
  const out: (string | null)[][] = []
  for (let c = 0; c < cols; c++) out.push(rows.map((r) => r[c] ?? null))
  return out
}
