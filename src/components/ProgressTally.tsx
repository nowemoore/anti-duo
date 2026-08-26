/**
 * "80 of 238 kanji unlocked", with a bar under it. The header every section page opens with.
 *
 * Both numbers at one size — the count is the interesting half, but blowing it up makes the total
 * look like a footnote when it's the thing being counted against. Only colour separates them.
 *
 * Shared rather than copied so the kanji and kana pages can't drift; the wording after the total is
 * the caller's, since one page counts what's unlocked and the other what's been studied.
 */
export function ProgressTally({ count, total, label }: { count: number; total: number; label: string }) {
  return (
    <div className="tally">
      <p className="tally-row">
        <span className="tally-count">{count}</span>
        <span className="tally-of">
          of {total} {label}
        </span>
      </p>
      <span className="stats-bar">
        <span className="stats-bar-fill" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
      </span>
    </div>
  )
}
