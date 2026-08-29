import { useMemo, useRef, useState } from 'react'
import type { Unit } from '../../shared/types'
import { boardList, categoryOptions, radicalOptions, type BoardFilters } from '../lib/board'
import { isUnitEnabled, toggleInList } from '../lib/categories'
import { masteryProgress, masteryTier, readyForMore, type MasteryTier } from '../lib/study'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Legend } from './Legend'
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
 * Ordered by stroke count, fewest first (see `sortByStrokes`), so the grid runs from 一 to the
 * intricate end of the curriculum and the shape of the board matches the shape of the work. Two
 * filters narrow it: a topic and a radical, which compose — each one's options are counted against
 * the other, so the pair reads as a single query.
 *
 * Holding a tile (or right-clicking it) drops that kanji out of practice and learning. Disabled
 * tiles stay on the board, faded: filtering them out would leave no way back short of Settings.
 */
export function KanjiBoard({ onSelect }: { onSelect: (u: Unit) => void }) {
  const index = useContent()
  const { progress, update } = useProgress()
  const [filters, setFilters] = useState<BoardFilters>({ category: null, radical: null })

  // Rebuilding the list means sorting a few hundred units and walking them twice for the option
  // counts — cheap, but not on every hover, so it's memoised on what actually changes it.
  const units = useMemo(() => boardList(index, progress, filters), [index, progress, filters])
  const categories = useMemo(
    () => categoryOptions(index, progress, { radical: filters.radical }),
    [index, progress, filters.radical],
  )
  const radicals = useMemo(
    () => radicalOptions(index, progress, { category: filters.category }),
    [index, progress, filters.category],
  )
  const filtered = Boolean(filters.category?.length || filters.radical?.length)

  const unlockEvery = index.lang.batchUnlockEvery
  const stateOf = (u: Unit): TileState => {
    if (!isUnitEnabled(progress.settings, u)) return 'off'
    return readyForMore(progress, u, unlockEvery)
      ? 'more'
      : masteryTier(progress.units[u.idx]?.lvl ?? 0)
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

  return (
    <div className="board">
      {/* The key comes first: it explains what the grid below means, and a key you only reach after
          scrolling past the grid has missed its moment. */}
      <Legend items={TIERS.map(({ tier, label }) => ({ swatchClass: `tile-${tier}`, label }))} />

      <div className="board-filters">
        <label className="board-filter">
          <span className="board-filter-label">Topic</span>
          <select
            value={filters.category?.[0] ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value ? [e.target.value] : null }))}
          >
            <option value="">All topics</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.value} ({c.count})
              </option>
            ))}
          </select>
        </label>

        <label className="board-filter">
          <span className="board-filter-label">Radical</span>
          <select
            value={filters.radical?.[0] ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, radical: e.target.value ? [e.target.value] : null }))}
          >
            <option value="">All radicals</option>
            {radicals.map((r) => (
              <option key={r.value} value={r.value}>
                {r.value}
                {r.label ? ` · ${r.label}` : ''} ({r.count})
              </option>
            ))}
          </select>
        </label>

        {/* Only worth offering once something is actually narrowed. */}
        {filtered && (
          <button
            type="button"
            className="board-filter-clear"
            onClick={() => setFilters({ category: null, radical: null })}
          >
            <FontAwesomeIcon icon="xmark" />
            Clear
          </button>
        )}
      </div>

      {units.length === 0 ? (
        <p className="board-empty">
          {filtered ? 'No kanji match those filters.' : 'No kanji in the enabled set.'}
        </p>
      ) : (
        <>
          {waiting > 0 && (
            <p className="board-prompt">
              Ready for more? {waiting} {waiting === 1 ? 'kanji has' : 'kanji have'} new words
              waiting.
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
                  aria-label={
                    state === 'more' ? `${u.form}, ready for more` : `${u.form}, ${state}`
                  }
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
        </>
      )}
    </div>
  )
}
