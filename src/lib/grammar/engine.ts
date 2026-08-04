// Grammar subsection engine: attempt preparation, scoring, and unlock gating. Pure functions over
// a GrammarTopic + the persisted GrammarTopicProgress — no React, no topic-specific knowledge.
import { GRAMMAR_ATTEMPT_HISTORY, GRAMMAR_PASS_ACCURACY, INTRODUCED_LEVEL } from '../../../shared/constants'
import type {
  GrammarAttempt,
  GrammarItemResult,
  GrammarReflection,
  GrammarTopicProgress,
  Progress,
} from '../../../shared/types'
import { pick, shuffle } from '../random'
import type {
  CueKind,
  GrammarContext,
  GrammarCue,
  GrammarItem,
  GrammarTopic,
  PreparedItem,
} from './types'

/** The four parts, in order. Each unlocks only once the previous one's condition is met. */
export type PartId = 'vocab' | 'minigame' | 'reflection' | 'explanation'
export const PART_ORDER: PartId[] = ['vocab', 'minigame', 'reflection', 'explanation']

/** Empty state for a topic the learner hasn't opened yet. */
export function emptyTopicProgress(): GrammarTopicProgress {
  return { attempts: [], reflections: {} }
}

export function topicProgress(progress: Progress, topicId: string): GrammarTopicProgress {
  return progress.grammar?.[topicId] ?? emptyTopicProgress()
}

// ---------------------------------------------------------------------------
// Attempt preparation
// ---------------------------------------------------------------------------

/**
 * Assign a cue kind to each of `count` items, split as evenly as possible between habitual and
 * future, then shuffled. With an odd count the extra one goes to a random side, so the game never
 * leans the same way twice — ます is non-past, and a lopsided draw would quietly teach "ます = future".
 */
function balancedCueKinds(count: number): CueKind[] {
  const half = Math.floor(count / 2)
  const kinds: CueKind[] = [
    ...Array<CueKind>(half).fill('habitual'),
    ...Array<CueKind>(half).fill('future'),
  ]
  if (kinds.length < count) kinds.push(Math.random() < 0.5 ? 'habitual' : 'future')
  return shuffle(kinds)
}

/** Pair an item with a frame and a randomized left/right option order. */
function prepareItem(item: GrammarItem, cue: GrammarCue): PreparedItem {
  const options = [
    { label: item.correct, correct: true },
    { label: item.wrong, correct: false },
  ]
  return { item, cue, options: Math.random() < 0.5 ? options : [options[1], options[0]] }
}

/**
 * This topic's items, either from its fixed bank or derived from the learner's progress.
 *   'run' — the bank for one attempt (sampled, learner-scoped)
 *   'all' — every candidate, for resolving ids recorded by past attempts
 */
export function topicItems(
  topic: GrammarTopic,
  ctx: GrammarContext,
  scope: 'run' | 'all' = 'run',
): GrammarItem[] {
  return topic.minigame.buildItems?.(ctx, scope) ?? topic.minigame.items ?? []
}

/** How many items this learner can currently be given — drives the unlock gate and its message. */
export function availableItemCount(topic: GrammarTopic, ctx: GrammarContext): number {
  return topicItems(topic, ctx, 'run').length
}

/**
 * Whether the minigame is held back purely for want of material — the learner doesn't yet know
 * enough of the vocabulary it draws on.
 *
 * Keyed on having *played*, not on having started the topic: reading the vocabulary intro must not
 * count, or the requirement would quietly stop being reported to exactly the people part-way in.
 * Once an attempt exists this is false forever, so a later change to the enabled set can't re-lock
 * a part someone has already used.
 *
 * Shared by the gate itself and by the UI that explains it, so the two can't drift apart.
 */
export function isMinigameGated(
  topic: GrammarTopic,
  tp: GrammarTopicProgress,
  ctx: GrammarContext,
): boolean {
  const needed = topic.minigame.minItems ?? 0
  return tp.attempts.length === 0 && availableItemCount(topic, ctx) < needed
}

/**
 * Build one attempt's presentation order:
 *   - regular items shuffled freely,
 *   - exception items always last, shuffled among themselves,
 *   - every item gets a fresh time-word frame and a fresh left/right option order.
 * Called once per attempt, so retries genuinely reshuffle.
 */
export function prepareAttempt(topic: GrammarTopic, ctx: GrammarContext): PreparedItem[] {
  const { cues } = topic.minigame
  const items = topicItems(topic, ctx, 'run')
  const ordered = [
    ...shuffle(items.filter((i) => i.tier === 'regular')),
    ...shuffle(items.filter((i) => i.tier === 'exception')),
  ]
  const kinds = balancedCueKinds(ordered.length)
  return ordered.map((item, i) => {
    const kind = kinds[i]
    const pool = cues.filter((c) => c.kind === kind)
    // Fall back to the whole cue list if a topic supplies only one kind, rather than throwing.
    return prepareItem(item, pick(pool.length ? pool : cues))
  })
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * The furthest item the learner may navigate to, given which items they've answered so far.
 *
 * Backward movement is unrestricted — anything already seen can be revisited. Forward movement
 * stops at the first unanswered item, so you can always step one ahead but never skip past a
 * question you haven't answered. Once everything is answered the whole run is browsable.
 */
export function maxVisitableIndex(answers: readonly (number | null)[]): number {
  const firstUnanswered = answers.findIndex((a) => a == null)
  return firstUnanswered === -1 ? Math.max(0, answers.length - 1) : firstUnanswered
}

/** Fraction correct in [0, 1]; an attempt with no items scores 0. */
export function attemptAccuracy(attempt: GrammarAttempt): number {
  if (attempt.items.length === 0) return 0
  return attempt.items.filter((r) => r.correct).length / attempt.items.length
}

/** Best accuracy across all recorded attempts, or 0 if there are none. */
export function bestAccuracy(tp: GrammarTopicProgress): number {
  return tp.attempts.reduce((best, a) => Math.max(best, attemptAccuracy(a)), 0)
}

export function lastAttempt(tp: GrammarTopicProgress): GrammarAttempt | undefined {
  return tp.attempts[tp.attempts.length - 1]
}

/**
 * The items missed in the most recent attempt, resolved back to their bank entries.
 *
 * Resolves against the 'all' scope, never the sampled run — the attempt being read back may contain
 * items this learner can no longer be given (a unit dropped below INTRODUCED_LEVEL), and they still
 * belong in their own results.
 */
export function missedItems(
  topic: GrammarTopic,
  tp: GrammarTopicProgress,
  ctx: GrammarContext,
): { item: GrammarItem; picked: string }[] {
  const last = lastAttempt(tp)
  if (!last) return []
  const byId = new Map(topicItems(topic, ctx, 'all').map((i) => [i.id, i]))
  const aliases = topic.minigame.legacyItemIds ?? {}
  const out: { item: GrammarItem; picked: string }[] = []
  for (const r of last.items) {
    // Attempts recorded against an earlier bank carry its ids; map them forward.
    const item = byId.get(r.itemId) ?? byId.get(aliases[r.itemId] ?? '')
    // Skip results whose item no longer exists at all (word removed from the db since).
    if (!r.correct && item) out.push({ item, picked: r.picked })
  }
  return out
}

// ---------------------------------------------------------------------------
// Unlock gating
// ---------------------------------------------------------------------------

export function hasPassed(tp: GrammarTopicProgress): boolean {
  return bestAccuracy(tp) >= GRAMMAR_PASS_ACCURACY
}

/** How many of the topic's reflection prompts have a non-empty answer. */
export function reflectionAnsweredCount(topic: GrammarTopic, tp: GrammarTopicProgress): number {
  return topic.reflection.prompts.filter((p) => (tp.reflections[p.id]?.answer ?? '').trim().length > 0)
    .length
}

/** True once every reflection prompt has been answered. */
export function isReflectionComplete(topic: GrammarTopic, tp: GrammarTopicProgress): boolean {
  return reflectionAnsweredCount(topic, tp) === topic.reflection.prompts.length
}

/**
 * Whether a part is reachable. Parts unlock strictly in order, and a completed part stays
 * unlocked — nothing here ever re-locks once its condition has been met.
 *
 * The explanation carries two conditions, both required: the learner must have written their own
 * account of the pattern *before* being handed the official one (otherwise the reflection is just a
 * formality you can skip), and their best attempt must clear the accuracy threshold.
 */
export function isPartUnlocked(
  part: PartId,
  tp: GrammarTopicProgress,
  topic: GrammarTopic,
  ctx: GrammarContext,
): boolean {
  switch (part) {
    case 'vocab':
      return true
    case 'minigame':
      // Needs the vocabulary read AND enough material to be worth playing.
      return tp.vocabDoneAt != null && !isMinigameGated(topic, tp, ctx)
    case 'reflection':
      // "after the first completed attempt regardless of score"
      return tp.attempts.length > 0
    case 'explanation':
      return isReflectionComplete(topic, tp) && hasPassed(tp)
  }
}

/** Progress toward the pass threshold, for the locked-explanation state. */
export function passProgress(tp: GrammarTopicProgress): {
  best: number
  required: number
  attempts: number
} {
  return { best: bestAccuracy(tp), required: GRAMMAR_PASS_ACCURACY, attempts: tp.attempts.length }
}

// ---------------------------------------------------------------------------
// Progress writers (all pure: Progress in, Progress out)
// ---------------------------------------------------------------------------

function withTopic(
  progress: Progress,
  topicId: string,
  change: (tp: GrammarTopicProgress) => GrammarTopicProgress,
): Progress {
  const current = topicProgress(progress, topicId)
  return { ...progress, grammar: { ...progress.grammar, [topicId]: change(current) } }
}

/** Mark the vocab intro as finished (idempotent — the first completion timestamp is kept). */
export function markVocabDone(progress: Progress, topicId: string, now: string): Progress {
  return withTopic(progress, topicId, (tp) =>
    tp.vocabDoneAt ? tp : { ...tp, vocabDoneAt: now },
  )
}

/**
 * Record a finished attempt. Stamps `passedAt` the first time the threshold is reached and, at that
 * same moment, credits the topic's vocabulary units as learned (see {@link creditTopicUnits}).
 */
export function recordAttempt(
  progress: Progress,
  topic: GrammarTopic,
  results: GrammarItemResult[],
  now: string,
): Progress {
  const next = withTopic(progress, topic.id, (tp) => {
    const attempts = [...tp.attempts, { at: now, items: results }].slice(-GRAMMAR_ATTEMPT_HISTORY)
    const updated: GrammarTopicProgress = { ...tp, attempts }
    if (!updated.passedAt && hasPassed(updated)) updated.passedAt = now
    return updated
  })
  return creditTopicUnits(next, topic, now)
}

/** Save one reflection answer. `feedback` is left untouched (null until an LLM fills it in). */
export function saveReflection(
  progress: Progress,
  topicId: string,
  questionId: string,
  answer: string,
  now: string,
): Progress {
  return withTopic(progress, topicId, (tp) => {
    const existing: GrammarReflection | undefined = tp.reflections[questionId]
    return {
      ...tp,
      reflections: {
        ...tp.reflections,
        [questionId]: { answer, feedback: existing?.feedback ?? null, updatedAt: now },
      },
    }
  })
}

/**
 * Once the topic is passed, promote every curriculum unit written in its vocabulary to "introduced"
 * — completing the subsection is how you unlock the words it taught you. Units already at or above
 * INTRODUCED_LEVEL keep their level, so this can never demote existing progress. Runs once, guarded
 * by `unitsCreditedAt`; a no-op before the topic is passed.
 */
export function creditTopicUnits(progress: Progress, topic: GrammarTopic, now: string): Progress {
  const tp = topicProgress(progress, topic.id)
  if (!tp.passedAt || tp.unitsCreditedAt) return progress
  const units = { ...progress.units }
  for (const v of topic.vocab.words) {
    for (const idx of v.unitIdxs) {
      const lvl = units[idx]?.lvl ?? 0
      if (lvl < INTRODUCED_LEVEL) units[idx] = { ...units[idx], lvl: INTRODUCED_LEVEL }
    }
  }
  return withTopic({ ...progress, units }, topic.id, (t) => ({ ...t, unitsCreditedAt: now }))
}

/** Unit idx values this topic will credit, for the "you'll unlock these" hint in the intro. */
export function topicUnitIdxs(topic: GrammarTopic): number[] {
  return [...new Set(topic.vocab.words.flatMap((v) => v.unitIdxs))]
}
