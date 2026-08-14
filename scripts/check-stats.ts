// Verifies task success-rate tracking — `npm run check:stats`.
// Each answered task earns (delta+1)/2 of 1 possible point; the rate is earned ÷ attempts.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import {
  earnedPoints,
  isWordKnown,
  knownWordCount,
  recordTaskResult,
  recordWordResult,
  amendTaskResult,
  taskRates,
  restoreWordStreak,
} from '../src/lib/stats'
import { enabledWords, introducedWords } from '../src/lib/study'
import { ALL_TASK_TYPES, generateTask, testedWord } from '../src/lib/tasks'
import { normalizeProgress } from '../shared/progress'
import { WORD_KNOWN_STREAK, WORD_STREAK_MAX, defaultProgress } from '../shared/constants'
import type { Progress } from '../shared/types'

function rateOf(p: Progress, type: string): number | null {
  return taskRates(p).find((r) => r.type === type)?.rate ?? null
}

async function main() {
  // earnedPoints maps the [-1,+1] delta scale to [0,1] and clamps out-of-range input.
  const pointsOk =
    earnedPoints(1) === 1 &&
    earnedPoints(-1) === 0 &&
    earnedPoints(0) === 0.5 &&
    earnedPoints(0.5) === 0.75 &&
    earnedPoints(2) === 1 &&
    earnedPoints(-9) === 0

  // Binary task: 4 correct (+1) + 1 wrong (-1) → 4 points / 5 attempts = 0.8, i.e. fraction correct.
  let p = defaultProgress()
  for (const d of [1, 1, 1, 1, -1]) p = recordTaskResult(p, 'cloze', d)
  const clozeRow = taskRates(p).find((r) => r.type === 'cloze')!
  const binaryIsFractionCorrect = clozeRow.attempts === 5 && clozeRow.rate === 0.8

  // which-words partial credit: net +0.5 → 0.75 earned, net -0.5 → 0.25 earned; mean = 0.5.
  p = recordTaskResult(p, 'which-words', 0.5)
  p = recordTaskResult(p, 'which-words', -0.5)
  const partialCredit = rateOf(p, 'which-words') === 0.5

  // A net-zero which-words still counts as an attempt (worth 0.5 points).
  p = recordTaskResult(p, 'which-words', 0)
  const ww = taskRates(p).find((r) => r.type === 'which-words')!
  const zeroCounts = ww.attempts === 3 && Math.abs(ww.rate! - (0.75 + 0.25 + 0.5) / 3) < 1e-9

  // Untouched task types report null (not 0%).
  const untouchedNull = rateOf(defaultProgress(), 'type-word') === null

  // Round-trips through normalizeProgress; malformed entries are dropped.
  const dirty = {
    ...defaultProgress(),
    stats: { cloze: { attempts: 3, points: 2 }, junk: { attempts: 'x' }, bad: null },
  } as unknown as Progress
  const cleaned = normalizeProgress(dirty)
  const normalizeOk =
    cleaned.stats?.cloze?.attempts === 3 &&
    cleaned.stats?.cloze?.points === 2 &&
    !('junk' in (cleaned.stats ?? {})) &&
    !('bad' in (cleaned.stats ?? {}))

  // --- per-word "known" runs ------------------------------------------------
  const index = buildContentIndex(await loadContent())

  // A word becomes known after WORD_KNOWN_STREAK correct in a row, and a miss walks it back.
  let w: Progress = defaultProgress()
  const climb: boolean[] = []
  for (let i = 0; i < WORD_KNOWN_STREAK; i++) {
    w = recordWordResult(w, '食べる', true)
    climb.push(isWordKnown(w, '食べる'))
  }
  const knownOnlyAtThreshold = climb.slice(0, -1).every((k) => !k) && climb[climb.length - 1]

  const afterMiss = recordWordResult(w, '食べる', false)
  const missUnknows = !isWordKnown(afterMiss, '食べる') && knownWordCount(afterMiss) === 0
  const winsItBack = isWordKnown(recordWordResult(afterMiss, '食べる', true), '食べる')

  // Runs climb past the known threshold, up to WORD_STREAK_MAX. The extra counts are buffer: a word
  // answered well beyond the threshold survives a miss without dropping out of the count.
  let capped = w
  for (let i = 0; i < WORD_STREAK_MAX * 2; i++) capped = recordWordResult(capped, '食べる', true)
  const cappedAtMax = capped.words?.['食べる'] === WORD_STREAK_MAX
  const bufferHoldsKnown = isWordKnown(recordWordResult(capped, '食べる', false), '食べる')

  // Floored at zero, and a zeroed word is dropped rather than kept as a 0 entry forever.
  const floored = recordWordResult(recordWordResult(defaultProgress(), '見る', false), '見る', false)
  const flooredAndPruned = !('見る' in (floored.words ?? {}))

  // An override restores the run to what it was.
  const overridden = restoreWordStreak(recordWordResult(defaultProgress(), '書く', true), '書く', 0)
  const overrideReverses = !('書く' in (overridden.words ?? {}))

  // The boundaries are where "apply the opposite operation" would go wrong: a miss against a run
  // already at 0 changes nothing, so undoing it must not hand out a point that was never taken.
  const atFloor = recordWordResult(defaultProgress(), '書く', false) // no-op, already 0
  const floorOverrideNeutral = !('書く' in (restoreWordStreak(atFloor, '書く', 0).words ?? {}))
  // Same at the ceiling: a correct answer at WORD_STREAK_MAX doesn't move, so nor should its undo.
  const atCeiling = recordWordResult(capped, '食べる', true)
  const ceilingOverrideNeutral =
    restoreWordStreak(atCeiling, '食べる', WORD_STREAK_MAX).words?.['食べる'] === WORD_STREAK_MAX

  // Overriding a draw verdict re-scores the answer as the learner's verdict, so it must land exactly
  // where cleanly answering that way would have — same run, same success rate, still one attempt.
  const overrideMatchesCleanAnswer = ([0, 3] as const).every((start) => {
    const base = (): Progress => ({ ...defaultProgress(), words: start ? { 走る: start } : {} })
    // Recognizer says wrong and is recorded, then the learner overrides to "actually right".
    let disputed = recordWordResult(recordTaskResult(base(), 'draw', -1), '走る', false)
    disputed = amendTaskResult(disputed, 'draw', -1, 1)
    disputed = recordWordResult(restoreWordStreak(disputed, '走る', start), '走る', true)
    // The same question answered correctly first time.
    const clean = recordWordResult(recordTaskResult(base(), 'draw', 1), '走る', true)
    const row = (x: Progress) => taskRates(x).find((r) => r.type === 'draw')!
    return (
      (disputed.words?.['走る'] ?? 0) === (clean.words?.['走る'] ?? 0) &&
      row(disputed).rate === row(clean).rate &&
      row(disputed).attempts === row(clean).attempts
    )
  })
  // Amending never invents an extra attempt — the question was asked once.
  const amendKeepsAttempts =
    taskRates(amendTaskResult(recordTaskResult(defaultProgress(), 'draw', -1), 'draw', -1, 1)).find(
      (r) => r.type === 'draw',
    )!.attempts === 1

  // The count is scoped to a word set, so it can't exceed the card's own denominator.
  const scoped = knownWordCount(w, new Set(['見る'])) === 0 && knownWordCount(w, new Set(['食べる'])) === 1

  // Crediting is filtered through index.words, so an inflected sentence token (食べた) never becomes
  // a "known word" alongside its dictionary form. Confirm the filter actually has something to do —
  // if every tested word were already vocabulary the guard would be dead code and could rot away.
  const words = enabledWords(index, defaultProgress())
  let named = 0
  let filteredOut = 0
  for (const unit of index.content.units.slice(0, 60)) {
    for (const type of ALL_TASK_TYPES) {
      const task = generateTask(index, unit.idx, type)
      if (!task) continue
      const word = testedWord(task)
      if (word === null) continue
      if (index.words.has(word)) named++
      else filteredOut++
    }
  }
  const vocabIsSubset = [...index.words].every((x) => words.has(x))

  // The Stats card counts against the words of the kanji you've been introduced to, not the whole
  // curriculum — otherwise early progress reads as 12 of 929 and the word list is mostly vocabulary
  // for kanji never taught. Must start empty, grow with progress, and stay inside enabledWords.
  const fresh = defaultProgress()
  const someLearned = { ...fresh, units: Object.fromEntries(index.content.units.slice(0, 60).map((u) => [u.idx, { lvl: 1 }])) }
  const allLearned = { ...fresh, units: Object.fromEntries(index.content.units.map((u) => [u.idx, { lvl: 1 }])) }
  const introNone = introducedWords(index, fresh)
  const introSome = introducedWords(index, someLearned)
  const introAll = introducedWords(index, allLearned)
  const scopeGrows =
    introNone.size === 0 &&
    introSome.size > introNone.size &&
    introAll.size === words.size &&
    [...introSome].every((x) => words.has(x))
  const whichWordsAbstains = index.content.units
    .slice(0, 60)
    .map((u) => generateTask(index, u.idx, 'which-words'))
    .filter((t) => t !== null)
    .every((t) => testedWord(t!) === null)

  // Round-trip: the map must survive normalizeProgress, which rebuilds Progress field by field.
  const roundTripped = normalizeProgress(JSON.parse(JSON.stringify(w)) as Progress)
  const wordsSurvive = roundTripped.words?.['食べる'] === WORD_KNOWN_STREAK

  const dirtyWords = {
    ...defaultProgress(),
    words: { good: 3, tooBig: 99, negative: -4, notANumber: 'x', empty: 0, '': 2 },
  } as unknown as Progress
  const cleanedWords = normalizeProgress(dirtyWords).words ?? {}
  const wordsNormalized =
    cleanedWords.good === 3 &&
    cleanedWords.tooBig === WORD_STREAK_MAX && // clamped, not trusted
    !('negative' in cleanedWords) &&
    !('notANumber' in cleanedWords) &&
    !('empty' in cleanedWords) &&
    !('' in cleanedWords)

  const checks: [string, boolean][] = [
    ['earnedPoints maps/clamps the delta scale', pointsOk],
    [`a word is known only at ${WORD_KNOWN_STREAK} correct in a row`, knownOnlyAtThreshold],
    ['a miss un-knows a word', missUnknows],
    ['one correct wins it back', winsItBack],
    [`the run climbs past the threshold and caps at ${WORD_STREAK_MAX}`, cappedAtMax],
    ['a buffered word survives a miss and stays known', bufferHoldsKnown],
    ['an override at the run floor awards nothing', floorOverrideNeutral],
    ['an override at the run ceiling takes nothing away', ceilingOverrideNeutral],
    ['the run floors at 0 and the entry is pruned', flooredAndPruned],
    ['an override reverses exactly one answer', overrideReverses],
    ['an override re-scores as the verdict the learner gave', overrideMatchesCleanAnswer],
    ['amending a verdict does not add a second attempt', amendKeepsAttempts],
    ['knownWordCount can be scoped to a word set', scoped],
    [`testedWord names curated vocabulary for most tasks (${named} credited)`, named > 0],
    [`non-vocabulary focus words exist and are filtered out (${filteredOut} skipped)`, filteredOut > 0],
    ['the credited vocabulary is a subset of the Stats denominator', vocabIsSubset],
    ['the Stats scope is the words of introduced kanji, and grows', scopeGrows],
    ['which-words credits no single word', whichWordsAbstains],
    ['word runs survive the normalizeProgress round-trip', wordsSurvive],
    ['malformed word entries are dropped or clamped', wordsNormalized],
    ['untouched progress gains no words key', !('words' in normalizeProgress(defaultProgress()))],
    ['binary rate = fraction correct (0.8 for 4/5)', binaryIsFractionCorrect],
    ['which-words scores per-option partial credit', partialCredit],
    ['net-zero answer still counts as an attempt', zeroCounts],
    ['untouched task type reports null', untouchedNull],
    ['stats round-trip; malformed entries dropped', normalizeOk],
  ]

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: stats tracking correct' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
