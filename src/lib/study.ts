import { INTRODUCED_LEVEL, LEARN_CHUNK } from '../../shared/constants'
import type { Kanji, Progress } from '../../shared/types'
import type { ContentIndex } from './content'
import { isKanjiEnabled } from './categories'
import { shuffle } from './random'

/**
 * Kanji not introduced yet OR forgotten (lvl < INTRODUCED_LEVEL) — eligible to be (re)taught.
 * Scoped to the enabled learning set (selected categories / kanji).
 */
export function unlearnedKanji(index: ContentIndex, progress: Progress): Kanji[] {
  return index.content.kanji.filter(
    (k) => isKanjiEnabled(progress.settings, k) && (progress.kanji[k.idx]?.lvl ?? 0) < INTRODUCED_LEVEL,
  )
}

/** Introduced/known kanji (lvl ≥ INTRODUCED_LEVEL), scoped to the enabled learning set. */
export function introducedKanji(index: ContentIndex, progress: Progress): Kanji[] {
  return index.content.kanji.filter(
    (k) => isKanjiEnabled(progress.settings, k) && (progress.kanji[k.idx]?.lvl ?? 0) >= INTRODUCED_LEVEL,
  )
}

/** How many new kanji one Learn click will introduce (≤ LEARN_CHUNK, capped by what's left). */
export function learnChunkSize(index: ContentIndex, progress: Progress): number {
  return Math.min(LEARN_CHUNK, unlearnedKanji(index, progress).length)
}

/**
 * One Learn click's chunk: up to {@link LEARN_CHUNK} kanji chosen **uniformly at random** from the
 * unlearned kanji in the enabled set. Call once per Learn (the result is random).
 */
export function nextLearnChunk(index: ContentIndex, progress: Progress): Kanji[] {
  const size = learnChunkSize(index, progress)
  if (size <= 0) return []
  return shuffle(unlearnedKanji(index, progress)).slice(0, size)
}

/** (Re)introduce the chunk to at least INTRODUCED_LEVEL. */
export function applyLearned(progress: Progress, learned: Kanji[]): Progress {
  const kanji = { ...progress.kanji }
  for (const k of learned) {
    kanji[k.idx] = { lvl: Math.max(INTRODUCED_LEVEL, kanji[k.idx]?.lvl ?? 0) }
  }
  return {
    ...progress,
    kanji,
    lastRunAt: new Date().toISOString(),
  }
}
