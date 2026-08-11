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
  taskRates,
  unrecordWordResult,
} from '../src/lib/stats'
import { enabledWords } from '../src/lib/study'
import { ALL_TASK_TYPES, generateTask, testedWord } from '../src/lib/tasks'
import { normalizeProgress } from '../shared/progress'
import { WORD_KNOWN_STREAK, defaultProgress } from '../shared/constants'
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

  // Capped at the threshold, so a known word lapses on one miss rather than several.
  let capped = w
  for (let i = 0; i < 5; i++) capped = recordWordResult(capped, '食べる', true)
  const cappedAtThreshold = capped.words?.['食べる'] === WORD_KNOWN_STREAK

  // Floored at zero, and a zeroed word is dropped rather than kept as a 0 entry forever.
  const floored = recordWordResult(recordWordResult(defaultProgress(), '見る', false), '見る', false)
  const flooredAndPruned = !('見る' in (floored.words ?? {}))

  // An override reverses exactly one recorded answer.
  const overridden = unrecordWordResult(recordWordResult(defaultProgress(), '書く', true), '書く', true)
  const overrideReverses = !('書く' in (overridden.words ?? {}))

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
    cleanedWords.tooBig === WORD_KNOWN_STREAK && // clamped, not trusted
    !('negative' in cleanedWords) &&
    !('notANumber' in cleanedWords) &&
    !('empty' in cleanedWords) &&
    !('' in cleanedWords)

  const checks: [string, boolean][] = [
    ['earnedPoints maps/clamps the delta scale', pointsOk],
    [`a word is known only at ${WORD_KNOWN_STREAK} correct in a row`, knownOnlyAtThreshold],
    ['a miss un-knows a word', missUnknows],
    ['one correct wins it back', winsItBack],
    ['the run is capped at the threshold', cappedAtThreshold],
    ['the run floors at 0 and the entry is pruned', flooredAndPruned],
    ['an override reverses exactly one answer', overrideReverses],
    ['knownWordCount can be scoped to a word set', scoped],
    [`testedWord names curated vocabulary for most tasks (${named} credited)`, named > 0],
    [`non-vocabulary focus words exist and are filtered out (${filteredOut} skipped)`, filteredOut > 0],
    ['the credited vocabulary is a subset of the Stats denominator', vocabIsSubset],
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
