import type { Kanji, Settings } from '../../shared/types'
import type { ContentIndex } from './content'

/** A category is on unless explicitly disabled. */
export function isCategoryEnabled(settings: Settings, name: string): boolean {
  return !settings.disabledCategories.includes(name)
}

/** A kanji is in play iff its category is on AND it isn't individually disabled. */
export function isKanjiEnabled(settings: Settings, kanji: Kanji): boolean {
  return isCategoryEnabled(settings, kanji.category) && !settings.disabledKanji.includes(kanji.idx)
}

/** How many kanji are currently in play across the whole curriculum. */
export function enabledKanjiCount(index: ContentIndex, settings: Settings): number {
  return index.content.kanji.reduce((n, k) => n + (isKanjiEnabled(settings, k) ? 1 : 0), 0)
}

/** Toggle helpers return new arrays (immutable update). */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value]
}
