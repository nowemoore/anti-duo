import type { Unit, Settings } from '../../shared/types'
import type { ContentIndex } from './content'

/** A category is on unless explicitly disabled. */
export function isCategoryEnabled(settings: Settings, name: string): boolean {
  return !settings.disabledCategories.includes(name)
}

/** A kanji is in play iff its category is on AND it isn't individually disabled. */
export function isUnitEnabled(settings: Settings, kanji: Unit): boolean {
  return isCategoryEnabled(settings, kanji.category) && !settings.disabledUnits.includes(kanji.idx)
}

/** How many kanji are currently in play across the whole curriculum. */
export function enabledUnitCount(index: ContentIndex, settings: Settings): number {
  return index.content.units.reduce((n, k) => n + (isUnitEnabled(settings, k) ? 1 : 0), 0)
}

/** Toggle helpers return new arrays (immutable update). */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}
