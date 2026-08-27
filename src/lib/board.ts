// The kanji board: which units it shows, in what order, and the two filters over it.
//
// Pure TS (no React, no react-native) — the web board and the phone's mosaic both read from here, so
// the two can't drift on what "sorted by strokes" or "filtered to 木" means. Vendored into the
// mobile app by mobile/scripts/sync-shared.js.
import type { Progress, Unit } from '../../shared/types'
import type { ContentIndex } from './content'
import { isCategoryEnabled } from './categories'

/** Neither filter set = show everything. `null` is "no filter", never "unknown". */
export interface BoardFilters {
  /** A single category name, or null for all of them. */
  category?: string | null
  /** A single classifying radical character, or null for all of them. */
  radical?: string | null
}

/** A filter option and how many board units it covers, for a picker that can show its own counts. */
export interface FilterOption {
  value: string
  count: number
  /** English gloss of a radical character, where the db has one. Absent for categories. */
  label?: string
}

/**
 * The units the board draws from: everything in an enabled *category*, disabled units included.
 *
 * A unit switched off individually stays on the board, faded — filtering it out would leave no way
 * back short of hunting through Settings. A whole category switched off is a different statement:
 * you've said you aren't learning those at all.
 */
export function boardUnits(index: ContentIndex, progress: Progress): Unit[] {
  return index.content.units.filter((u) => isCategoryEnabled(progress.settings, u.category))
}

/**
 * Board order: fewest strokes first.
 *
 * Complexity is the author's stroke rating, so the grid runs from 一 to the 18-stroke end of the
 * curriculum and the shape of the board matches the shape of the work. Ties break on `idx`, which
 * is teaching order — so among equally simple characters you meet them in the order the course
 * introduces them, and the order is fully deterministic either way. A unit with no rating sorts
 * last rather than first: unrated is unknown, and unknown isn't "simple".
 */
export function sortByStrokes(units: Unit[]): Unit[] {
  return [...units].sort(
    (a, b) => (a.complexity ?? Infinity) - (b.complexity ?? Infinity) || a.idx - b.idx,
  )
}

/** The classifying radical of a unit, or '' when the db has none for it. */
export function radicalOf(index: ContentIndex, unit: Unit): string {
  return index.content.kanjiRadicals[unit.form] ?? ''
}

/** The board's units, filtered and sorted — the one call a board view needs. */
export function boardList(
  index: ContentIndex,
  progress: Progress,
  filters: BoardFilters = {},
): Unit[] {
  const units = boardUnits(index, progress).filter((u) => {
    if (filters.category && u.category !== filters.category) return false
    if (filters.radical && radicalOf(index, u) !== filters.radical) return false
    return true
  })
  return sortByStrokes(units)
}

/**
 * Topic options, in the order the curriculum introduces them.
 *
 * Counted against the *other* filter, so the two read as one query: with a radical chosen, each
 * topic shows how many of its kanji share that radical, and a topic that would empty the board is
 * simply absent from the list rather than offered and then disappointing.
 */
export function categoryOptions(
  index: ContentIndex,
  progress: Progress,
  filters: BoardFilters = {},
): FilterOption[] {
  const counts = new Map<string, number>()
  for (const u of boardUnits(index, progress)) {
    if (filters.radical && radicalOf(index, u) !== filters.radical) continue
    counts.set(u.category, (counts.get(u.category) ?? 0) + 1)
  }
  return [...counts].map(([value, count]) => ({ value, count }))
}

/**
 * Radical options, commonest first.
 *
 * Sorted by how many kanji share them rather than alphabetically or by stroke count: 人 with its 16
 * members is a family worth looking at, and the 63 radicals with a single kanji to their name are
 * the tail of the list, where they belong. Each carries its English gloss where the db has one, so
 * the picker isn't 129 bare characters.
 */
export function radicalOptions(
  index: ContentIndex,
  progress: Progress,
  filters: BoardFilters = {},
): FilterOption[] {
  const counts = new Map<string, number>()
  for (const u of boardUnits(index, progress)) {
    if (filters.category && u.category !== filters.category) continue
    const r = radicalOf(index, u)
    if (!r) continue
    counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count, label: glossOf(index, value) }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ja'))
}

/** First English meaning of a character, for labelling a radical. Undefined when the db has none. */
function glossOf(index: ContentIndex, char: string): string | undefined {
  const meaning = index.content.kanjiMeanings[char]
  return meaning ? meaning.split(';')[0].trim() : undefined
}
