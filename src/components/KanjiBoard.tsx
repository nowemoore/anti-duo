import { useRef } from 'react'
import type { Unit } from '../../shared/types'
import { isCategoryEnabled, isUnitEnabled, toggleInList } from '../lib/categories'
import { masteryProgress, masteryTier, readyForMore, type MasteryTier } from '../lib/study'
import { useContent } from '../context/ContentContext'
import { useProgress } from '../context/ProgressContext'

/** The mastery ramp, plus the two states that aren't on it. */
type TileState = MasteryTier | 'more' | 'off'

/** Alpha a just-introduced tile carries, so it still reads as coloured rather than empty. */
const FILL_FLOOR = 0.18

/** How long a press has to be held before it counts as the "disable this kanji" gesture. */
const HOLD_MS = 500

const TIERS: { tier: TileState; label: string }[] = [
  { tier: 'unseen', label: 'not viewed' },
  { tier: 'introduced', label: 'introduced' },
  { tier: 'learnt', label: 'learnt' },
  { tier: 'more', label: 'ready for more' },
  { tier: 'off', label: 'off' },
]

/**
 * The whole curriculum as one board of tiles, each shaded by how solid that kanji is — the further
 * along you are, the pinker the board.
 *
 * Deliberately shows *every* enabled kanji rather than only the studied ones, because the shape of
 * what's left is the interesting part: a list of what you already know tells you nothing about the
 * road ahead. Clicking a tile studies that kanji.
 *
 * Green sits outside the pink ramp on purpose: it isn't "more mastered than solid", it's a different
 * kind of thing — this kanji has levelled far enough to have unlocked example words you haven't been
 * shown. Opening it clears the flag.
 *
 * Holding a tile (or right-clicking it) drops that kanji out of practice and learning. Disabled
 * tiles stay on the board, faded: filtering them out would leave no way back short of Settings.
 */
export function KanjiBoard({ onSelect }: { onSelect: (u: Unit) => void }) {
  const index = useContent()
  const { progress, update } = useProgress()
  // Everything in the enabled *categories*, disabled units included — see the note above.
  const units = index.content.units.filter((u) => isCategoryEnabled(progress.settings, u.category))

  const unlockEvery = index.lang.batchUnlockEvery
  const stateOf = (u: Unit): TileState => {
    if (!isUnitEnabled(progress.settings, u)) return 'off'
    return readyForMore(progress, u, unlockEvery) ? 'more' : masteryTier(progress.units[u.idx]?.lvl ?? 0)
  }
  const waiting = units.filter((u) => stateOf(u) === 'more').length

  /*
   * Introduced → learnt is a ramp, not two steps: the tile carries the accent at an alpha that grows
   * with the level, so the board fills in gradually as a kanji beds in. `color-mix` against the
   * accent variable, so a palette change takes the ramp with it.
   */
  const fillFor = (u: Unit) => {
    const t = masteryProgress(progress.units[u.idx]?.lvl ?? 0)
    const pct = Math.round((FILL_FLOOR + (1 - FILL_FLOOR) * t) * 100)
    return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
  }

  /** Hold to drop a kanji out of practice, hold again to bring it back. Same list Settings edits. */
  const toggleUnit = (u: Unit) =>
    update((p) => ({
      ...p,
      settings: { ...p.settings, disabledUnits: toggleInList(p.settings.disabledUnits, u.idx) },
    }))

  // A press that turns into a hold toggles the unit and cancels the click that would follow it.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const startHold = (u: Unit) => {
    held.current = false
    holdTimer.current = setTimeout(() => {
      held.current = true
      toggleUnit(u)
    }, HOLD_MS)
  }
  const endHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current)
    holdTimer.current = null
  }

  if (units.length === 0) return <p className="board-empty">No kanji in the enabled set.</p>

  return (
    <div className="board">
      {waiting > 0 && (
        <p className="board-prompt">
          Ready for more? {waiting} {waiting === 1 ? 'kanji has' : 'kanji have'} new words waiting.
        </p>
      )}

      {/* One wrapping grid: `auto-fill` sizes the columns, so nothing here has to measure a width. */}
      <div className="board-grid">
        {units.map((u) => {
          const state = stateOf(u)
          // The ramp only applies between the two ends; unseen, ready and off are flat.
          const ramped = state !== 'off' && state !== 'more' && state !== 'unseen'
          return (
            <button
              key={u.idx}
              type="button"
              className={`tile ${state}`}
              style={ramped ? { background: fillFor(u) } : undefined}
              aria-label={state === 'more' ? `${u.form}, ready for more` : `${u.form}, ${state}`}
              title={state === 'off' ? 'Hold to turn back on' : 'Hold to turn off for practice'}
              onClick={() => {
                // Swallow the click the browser fires at the end of a hold.
                if (held.current) {
                  held.current = false
                  return
                }
                onSelect(u)
              }}
              onPointerDown={() => startHold(u)}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              // Right-click is the pointer equivalent of the phone's long press.
              onContextMenu={(e) => {
                e.preventDefault()
                toggleUnit(u)
              }}
            >
              {u.form}
            </button>
          )
        })}
      </div>

      <div className="board-legend">
        {TIERS.map(({ tier, label }) => (
          <span key={tier} className="legend-item">
            <span className={`legend-swatch tile-${tier}`} />
            <span className="legend-label">{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
