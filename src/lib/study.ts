import {
  INTRODUCED_LEVEL,
  LEARN_CHUNK,
  LEVEL_FLOOR,
  MASTERY_GETTING_THERE,
  MASTERY_SOLID,
} from '../../shared/constants'
import type { Unit, Progress } from '../../shared/types'
import type { ContentIndex } from './content'
import { isUnitEnabled } from './categories'
import { batchesUnlocked } from './tasks'
import { shuffle } from './random'

/**
 * Whether a kanji currently counts as known — taught at some point and not fully lapsed.
 *
 * The boundary is {@link LEVEL_FLOOR}, not INTRODUCED_LEVEL. A kanji is introduced *at*
 * INTRODUCED_LEVEL, so classifying at the same value left no margin: one wrong answer un-learned it.
 * Anchoring here means every taught kanji is either practisable or being re-taught, with no band in
 * between where it is neither.
 *
 * This is the single definition of "known"; {@link isForgotten} is its exact complement for kanji
 * that carry a progress entry. Use these rather than comparing levels inline.
 */
export function isKnownLevel(lvl: number): boolean {
  return lvl > LEVEL_FLOOR
}

/** A taught kanji that has lapsed all the way back to the floor, so it should be re-taught. */
export function isForgottenLevel(lvl: number): boolean {
  return !isKnownLevel(lvl)
}

/** Every unit in the enabled learning set, taught or not — the whole board, in curriculum order. */
export function enabledUnits(index: ContentIndex, progress: Progress): Unit[] {
  return index.content.units.filter((k) => isUnitEnabled(progress.settings, k))
}

/** How solid a unit looks, for the mosaic's four shades. */
export type MasteryTier = 'unseen' | 'shaky' | 'getting' | 'solid'

/**
 * Band a level falls into. `unseen` covers both never-taught and lapsed-to-the-floor units: from the
 * learner's point of view those are the same thing — something to pick up next.
 */
export function masteryTier(lvl: number): MasteryTier {
  if (!isKnownLevel(lvl)) return 'unseen'
  if (lvl < MASTERY_GETTING_THERE) return 'shaky'
  if (lvl < MASTERY_SOLID) return 'getting'
  return 'solid'
}

// --- staged example words ------------------------------------------------------------------

/** Batches of example words the learner has already been shown for a unit. Absent means just the first. */
export function seenBatches(progress: Progress, idx: number): number {
  const n = progress.units[idx]?.seenBatches
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

/**
 * Whether this unit has example words the learner has earned but not yet been shown — it levelled
 * past a batch boundary and the card has not been reopened since.
 *
 * Units with no staged words can never qualify, so this only ever flags the ones that genuinely have
 * more to give.
 */
export function readyForMore(progress: Progress, unit: Unit, unlockEvery?: number): boolean {
  if (!unit.examples.some((e) => (e.batch ?? 1) > 1)) return false
  const lvl = progress.units[unit.idx]?.lvl ?? 0
  return batchesUnlocked(lvl, unlockEvery) > seenBatches(progress, unit.idx)
}

/** Record that the unit's currently-unlocked batches have been shown, clearing {@link readyForMore}. */
export function ackBatches(progress: Progress, unit: Unit, unlockEvery?: number): Progress {
  const rec = progress.units[unit.idx]
  if (!rec) return progress
  const unlocked = batchesUnlocked(rec.lvl, unlockEvery)
  if (unlocked <= seenBatches(progress, unit.idx)) return progress
  return {
    ...progress,
    units: { ...progress.units, [unit.idx]: { ...rec, seenBatches: unlocked } },
  }
}

/**
 * Never introduced OR lapsed back to the floor — eligible to be (re)taught.
 * Scoped to the enabled learning set (selected categories / kanji).
 */
export function unlearnedUnits(index: ContentIndex, progress: Progress): Unit[] {
  return index.content.units.filter(
    (k) => isUnitEnabled(progress.settings, k) && !isKnownLevel(progress.units[k.idx]?.lvl ?? 0),
  )
}

/** Known kanji — practisable, scoped to the enabled learning set. */
export function introducedUnits(index: ContentIndex, progress: Progress): Unit[] {
  return index.content.units.filter(
    (k) => isUnitEnabled(progress.settings, k) && isKnownLevel(progress.units[k.idx]?.lvl ?? 0),
  )
}

/**
 * Introduced-then-forgotten kanji: they carry a progress entry (so were taught at least once) but
 * have since lapsed to the floor. The entry is what distinguishes them from never-seen kanji, which
 * have none — so only entries written by {@link applyLearned}/awardDelta count. These are prioritized
 * to the front of the next Learn set so a lapsed kanji is re-taught next.
 */
export function forgottenUnits(index: ContentIndex, progress: Progress): Unit[] {
  return index.content.units.filter((k) => {
    const rec = progress.units[k.idx]
    return isUnitEnabled(progress.settings, k) && rec !== undefined && isForgottenLevel(rec.lvl)
  })
}

/**
 * Every distinct example word across the enabled learning set — the denominator for "words known".
 *
 * Distinct by written form, so a word that is an example of two kanji (一人 under both 一 and 人)
 * counts once. Scoped to the enabled set like every other selector here, which does mean the total
 * moves when categories are toggled.
 */
export function enabledWords(index: ContentIndex, progress: Progress): Set<string> {
  const out = new Set<string>()
  for (const k of index.content.units) {
    if (!isUnitEnabled(progress.settings, k)) continue
    for (const ex of k.examples) out.add(ex.word)
  }
  return out
}

/**
 * The example words of every kanji the learner has been introduced to — vocabulary they have
 * actually met, and the scope the Stats card counts against.
 *
 * A subset of {@link enabledWords}, which spans the whole curriculum: measuring against that made
 * early progress invisible (12 of 929) and filled the word list with vocabulary for kanji not yet
 * taught. This grows as they learn — roughly 4.3 words per kanji.
 *
 * A multi-kanji word appears as soon as *any* of its kanji is introduced, since it's an example of
 * each of them. That's deliberately looser than {@link isWordLearned}, which requires every kanji
 * and gates what can be *tested*; this is "vocabulary I've met", not "vocabulary I can be quizzed on".
 */
export function introducedWords(index: ContentIndex, progress: Progress): Set<string> {
  const out = new Set<string>()
  for (const k of introducedUnits(index, progress)) {
    for (const ex of k.examples) out.add(ex.word)
  }
  return out
}

/** How many new kanji one Learn click will introduce (≤ LEARN_CHUNK, capped by what's left). */
export function learnChunkSize(index: ContentIndex, progress: Progress): number {
  return Math.min(LEARN_CHUNK, unlearnedUnits(index, progress).length)
}

/**
 * The prioritized (re)teach queue over the enabled unlearned pool: forgotten kanji first (so a
 * downgraded kanji is guaranteed to come back), then never-seen kanji. Both groups are shuffled
 * within themselves so order stays varied.
 */
export function learnQueue(index: ContentIndex, progress: Progress): Unit[] {
  const forgotten = forgottenUnits(index, progress)
  const forgottenIdx = new Set(forgotten.map((k) => k.idx))
  const fresh = unlearnedUnits(index, progress).filter((k) => !forgottenIdx.has(k.idx))
  return [...shuffle(forgotten), ...shuffle(fresh)]
}

/**
 * One Learn click's chunk: up to {@link LEARN_CHUNK} kanji from the front of the {@link learnQueue}
 * (forgotten-for-re-teach first, then random new). Call once per Learn (the result is random).
 */
export function nextLearnChunk(index: ContentIndex, progress: Progress): Unit[] {
  return learnQueue(index, progress).slice(0, learnChunkSize(index, progress))
}

/**
 * A full Learn session: the chunk to teach now, plus the remaining queue used as replacements when
 * the learner taps "Not now" on a card. Built from one {@link learnQueue} so the two never overlap.
 */
export function nextLearnSession(
  index: ContentIndex,
  progress: Progress,
): { chunk: Unit[]; reserve: Unit[] } {
  const queue = learnQueue(index, progress)
  const size = Math.min(LEARN_CHUNK, queue.length)
  return { chunk: queue.slice(0, size), reserve: queue.slice(size) }
}

/**
 * Apply a "Not now" to the card at `i`. When the reserve has a replacement, swap it into the card's
 * slot and re-queue the skipped kanji {@link SKIP_REQUEUE_GAP} slots back in the reserve — so it can
 * resurface later this session, but not immediately and not dead-last (it lands at the end only when
 * the reserve is shorter than the gap). With an empty reserve there's nothing to swap in, so the
 * card is dropped instead (deferred to a future Learn). Returns the new cards, reserve, and cursor.
 */
export function skipCard(
  cards: Unit[],
  reserve: Unit[],
  i: number,
  gap: number,
): { cards: Unit[]; reserve: Unit[]; index: number } {
  const skipped = cards[i]
  if (reserve.length > 0) {
    const [replacement, ...rest] = reserve
    const at = Math.min(gap, rest.length)
    const nextReserve = [...rest.slice(0, at), skipped, ...rest.slice(at)]
    const nextCards = cards.map((k, idx) => (idx === i ? replacement : k))
    return { cards: nextCards, reserve: nextReserve, index: i }
  }
  const nextCards = cards.filter((_, idx) => idx !== i)
  return { cards: nextCards, reserve, index: Math.min(i, nextCards.length - 1) }
}

/** (Re)introduce the chunk to at least INTRODUCED_LEVEL. */
export function applyLearned(progress: Progress, learned: Unit[]): Progress {
  const units = { ...progress.units }
  for (const k of learned) {
    units[k.idx] = { lvl: Math.max(INTRODUCED_LEVEL, units[k.idx]?.lvl ?? 0) }
  }
  return {
    ...progress,
    units,
    lastRunAt: new Date().toISOString(),
  }
}
