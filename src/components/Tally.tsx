/**
 * A count against its total — "5/10", used wherever the app shows progress as a pair.
 *
 * One rule, everywhere: no spaces around the slash, both numbers at the same size, and only colour
 * separating them. The total is the thing being counted against, so shrinking it makes it read as a
 * footnote; the count is what changed, so it takes the brighter ink.
 *
 * The size comes from whatever it's nested in — deliberately, because the same pair appears large on
 * a summary card and small in a subtitle.
 */
export function Tally({ count, total }: { count: number; total: number }) {
  return (
    <span className="tally-pair">
      {count}
      <span className="tally-pair-total">/{total}</span>
    </span>
  )
}
