// Builds the 〜ます minigame's item bank from the content db instead of a hand-written list.
//
// Candidates are the example words tagged with a verb class in dbs/ja_kanji.csv; the correct and
// wrong answers are conjugated from that class (see lang/jaVerbs). A run is then scoped to the verbs
// this learner has actually introduced, so the exercise tests vocabulary they own.
import { GRAMMAR_RUN_ITEMS } from '../../../shared/constants'
import type { Progress, Unit, Word } from '../../../shared/types'
import type { ContentIndex } from '../content'
import { isWordLearned, learnedUnitIdxs } from '../learned'
import {
  isDeceptive,
  politeNonPast,
  verbClassOf,
  wrongPoliteNonPast,
  type VerbClass,
  type WrongPattern,
} from '../lang/jaVerbs'
import { shuffle } from '../random'
import type { GrammarContext, GrammarItem } from './types'

/** A tagged verb joined to the unit it's an example of. */
interface VerbEntry {
  word: Word
  unit: Unit
  cls: VerbClass
}

/** Stable, word-derived item id. Survives bank growth, resampling, and reordering. */
export function verbItemId(form: string, reading?: string): string {
  return reading ? `v:${form}|${reading}` : `v:${form}`
}

/**
 * Every verb the exercise could ever use, in curriculum order.
 *
 * Irregulars are excluded on purpose. 来る is the only one in the db and it sits under unit 55 (来),
 * which this very topic credits on pass via 来週/来月 — including it would let the topic feed itself
 * new items, and it contradicts the explanation's footnote that neither irregular appears in the game.
 */
function candidates(index: ContentIndex): VerbEntry[] {
  const out: VerbEntry[] = []
  /*
   * One entry per *word*, not per listing. A word that is an example of more than one kanji — 出来る
   * sits under both 出 and 来 — is visited once per unit by this loop, and the second visit is the
   * same verb, not a second question.
   *
   * Sibling readings are the opposite case and both are kept: 止める is とめる "to stop" and やめる
   * "to quit", 開く is あく and ひらく. Those are different verbs sharing a spelling, they conjugate
   * differently (とめます / やめます), and the game shows the reading as furigana above the form — so
   * the learner sees two distinct questions, not the same card twice. See {@link verbItemId} for what
   * that means for their ids.
   */
  const seen = new Set<string>()
  for (const unit of index.content.units) {
    for (const word of unit.examples) {
      const cls = verbClassOf(word)
      if (!cls || cls === 'irregular-verb') continue
      // Skip anything we can't conjugate rather than risk teaching a wrong form.
      if (politeNonPast(word.reading, cls) === null) continue
      const identity = `${word.word}|${word.reading}`
      if (seen.has(identity)) continue
      seen.add(identity)
      out.push({ word, unit, cls })
    }
  }
  return out
}

/**
 * Written forms that more than one candidate shares, so their items can be told apart by id.
 *
 * Attempt history is keyed by item id, so `v:止める` alone would make a recorded answer ambiguous
 * about which of the two verbs it was for. Only these forms take the longer `v:form|reading` id —
 * every single-reading verb keeps the bare `v:食べる`, which is what history recorded under before.
 */
function ambiguousForms(entries: VerbEntry[]): Set<string> {
  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.word.word, (counts.get(e.word.word) ?? 0) + 1)
  return new Set([...counts].filter(([, n]) => n > 1).map(([form]) => form))
}

/** Conjugate one entry into a game item. `ambiguous` = this spelling has more than one reading. */
function toItem(e: VerbEntry, pattern: WrongPattern, ambiguous = false): GrammarItem | null {
  const correct = politeNonPast(e.word.reading, e.cls)
  const wrong = wrongPoliteNonPast(e.word.reading, e.cls, pattern)
  if (!correct || !wrong || correct === wrong) return null
  return {
    id: verbItemId(e.word.word, ambiguous ? e.word.reading : undefined),
    form: e.word.word,
    reading: e.word.reading,
    meaning: e.word.meaning,
    correct,
    wrong,
    // Derived, not authored: a u-verb ending in る is the deceptive case, so it sorts last.
    tier: isDeceptive(e.word.reading, e.cls) ? 'exception' : 'regular',
    note: e.cls,
  }
}

/**
 * Every candidate as an item, unsampled and unfiltered by progress.
 *
 * This is what persisted attempts resolve their item ids against. It must NOT be learner-scoped: the
 * learned set isn't monotonic (a unit can fall back below INTRODUCED_LEVEL, see study.forgottenUnits),
 * so resolving against a learner-scoped bank would blank out items they demonstrably answered.
 */
export function allVerbItems(index: ContentIndex): GrammarItem[] {
  const entries = candidates(index)
  const ambiguous = ambiguousForms(entries)
  const out: GrammarItem[] = []
  for (const e of entries) {
    const item = toItem(e, 'bolt', ambiguous.has(e.word.word))
    if (item) out.push(item)
  }
  return out
}

/** The verbs this learner knows — every kanji in the word introduced and enabled. */
function learnedCandidates(index: ContentIndex, progress: Progress): VerbEntry[] {
  const known = learnedUnitIdxs(index, progress)
  return candidates(index).filter((e) => isWordLearned(e.word.word, index, progress, known))
}

/** How many verbs the learner currently has available — drives the unlock gate and its message. */
export function learnedVerbCount(index: ContentIndex, progress: Progress): number {
  return dedupe(learnedCandidates(index, progress)).length
}

/**
 * The fewest additional units that would bring the learner up to `target` verbs — the honest answer
 * to "how many more kanji do I need?".
 *
 * Greedy over the cheapest verbs first (most need exactly one more kanji, a few compounds need two).
 * Each verb belongs to exactly one unit, so adding a unit unlocks at most one verb and the greedy
 * choice is optimal. Returns fewer than the shortfall only when the db runs out of verbs.
 *
 * This is a floor, not a forecast: units are taught in random order, so a learner will usually pass
 * through more than this many before happening to hit the ones that matter.
 */
export function unitsNeededForVerbs(
  index: ContentIndex,
  progress: Progress,
  target: number,
): number[] {
  const known = learnedUnitIdxs(index, progress)
  let have = learnedVerbCount(index, progress)
  if (have >= target) return []

  // Units already spoken for, so two verbs under one unit don't both look "free".
  const claimed = new Set(dedupe(learnedCandidates(index, progress)).map((e) => e.unit.idx))
  const missingFor = (e: VerbEntry): number[] =>
    [...new Set([...e.word.word].map((c) => index.byForm.get(c)?.idx))]
      .filter((idx): idx is number => idx !== undefined && !known.has(idx))

  const options = candidates(index)
    .filter((e) => !claimed.has(e.unit.idx))
    // A word containing a kanji outside the curriculum can never be unlocked at all.
    .filter((e) => [...e.word.word].every((c) => !/[㐀-䶿一-鿿豈-﫿]/.test(c) || index.byForm.get(c)))
    .map((e) => ({ e, missing: missingFor(e) }))
    .filter((o) => o.missing.length > 0)
    .sort((a, b) => a.missing.length - b.missing.length)

  const out = new Set<number>()
  for (const o of options) {
    if (have >= target) break
    if (claimed.has(o.e.unit.idx)) continue
    for (const idx of o.missing) out.add(idx)
    claimed.add(o.e.unit.idx)
    have++
  }
  return [...out]
}

/**
 * Drop entries that would collide in a run:
 *   - same reading AND same correct form (開く/空く both あく→あきます — indistinguishable as items).
 *     着る/切る survive this: same reading, different correct form, and the kanji prompt tells them
 *     apart. That pair is the sharpest item in the bank.
 *   - more than one verb from the same unit (始まる/始める, 止まる/止める, 集まる/集める, 開く/開ける):
 *     seeing the pair together hands over the class distinction.
 */
function dedupe(entries: VerbEntry[]): VerbEntry[] {
  const seenForm = new Set<string>()
  const seenUnit = new Set<number>()
  const out: VerbEntry[] = []
  for (const e of entries) {
    const correct = politeNonPast(e.word.reading, e.cls)
    const key = `${e.word.reading}|${correct}`
    if (seenForm.has(key) || seenUnit.has(e.unit.idx)) continue
    seenForm.add(key)
    seenUnit.add(e.unit.idx)
    out.push(e)
  }
  return out
}

/**
 * Assign wrong-answer patterns across a run, half 'cross' and half 'bolt', shuffled.
 *
 * The balance is load-bearing, not cosmetic: if every wrong answer were 'bolt' the game would be
 * winnable by "pick the option that isn't just the dictionary form plus ます", with no grammar
 * involved. Mirrors balancedCueKinds in engine.ts.
 */
function balancedPatterns(count: number): WrongPattern[] {
  const half = Math.floor(count / 2)
  const out: WrongPattern[] = [
    ...Array<WrongPattern>(half).fill('cross'),
    ...Array<WrongPattern>(half).fill('bolt'),
  ]
  if (out.length < count) out.push(Math.random() < 0.5 ? 'cross' : 'bolt')
  return shuffle(out)
}

/**
 * One run's bank: the learner's verbs, deduped, sampled down to GRAMMAR_RUN_ITEMS.
 *
 * Deceptive verbs always get the 'cross' wrong form — that pairing is what makes them a trap, and
 * a 'bolt' wrong would let the learner answer without ever noticing the verb isn't a ru-verb.
 * Nothing forces them into the sample: at ~21% of the pool they turn up on their own, and a run
 * without any is fine (the explanation says as much).
 */
export function buildVerbBank(ctx: GrammarContext): GrammarItem[] {
  const all = candidates(ctx.index)
  const pool = dedupe(learnedCandidates(ctx.index, ctx.progress))
  const picked = shuffle(pool).slice(0, GRAMMAR_RUN_ITEMS)
  // Against the whole curriculum, not this learner's slice: an id has to mean the same thing in
  // every run, or history recorded before they learned the sibling reading would stop resolving.
  const ambiguous = ambiguousForms(all)

  const plain = picked.filter((e) => !isDeceptive(e.word.reading, e.cls))
  const patterns = balancedPatterns(plain.length)

  let n = 0
  const out: GrammarItem[] = []
  for (const e of picked) {
    const deceptive = isDeceptive(e.word.reading, e.cls)
    const item = toItem(e, deceptive ? 'cross' : patterns[n++], ambiguous.has(e.word.word))
    if (item) out.push(item)
  }
  return out
}
