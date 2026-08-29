import type { ReactNode } from 'react'

export interface LegendItem {
  /** A CSS class naming the swatch's fill, so the key uses the board's own colours verbatim. */
  swatchClass: string
  label: ReactNode
}

/**
 * The key to a board of tiles: one swatch per state, on one line.
 *
 * Above the filters rather than below the grid. It explains what you are about to look at, and a
 * key you only meet after scrolling past the thing it explains has already missed its moment.
 */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="board-legend">
      {items.map((it, i) => (
        <span key={i} className="legend-item">
          <span className={`legend-swatch ${it.swatchClass}`} />
          <span className="legend-label">{it.label}</span>
        </span>
      ))}
    </div>
  )
}
