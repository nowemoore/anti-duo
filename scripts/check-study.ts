// Verifies the Learn selection logic — `npm run check:study`.
// Each Learn introduces up to 5 random, distinct, unlearned kanji from the enabled set; no daily cap.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { applyLearned, forgottenUnits, introducedUnits, learnChunkSize, nextLearnChunk, skipCard, unlearnedUnits } from '../src/lib/study'
import { defaultProgress, INTRODUCED_LEVEL, SKIP_REQUEUE_GAP } from '../shared/constants'

async function main() {
  const index = buildContentIndex(await loadContent())
  let p = defaultProgress()

  // Three back-to-back Learns (no daily cap): 5 each, all distinct, no repeats across clicks.
  const c1 = nextLearnChunk(index, p)
  p = applyLearned(p, c1)
  const c2 = nextLearnChunk(index, p)
  p = applyLearned(p, c2)
  const c3 = nextLearnChunk(index, p)
  p = applyLearned(p, c3)

  const all = [...c1, ...c2, ...c3]
  const distinct = new Set(all.map((k) => k.idx)).size === 15

  // Selection is random (not fixed order): the first chunk from two fresh profiles should differ.
  let differs = false
  for (let i = 0; i < 20 && !differs; i++) {
    const a = nextLearnChunk(index, defaultProgress()).map((k) => k.idx)
    const b = nextLearnChunk(index, defaultProgress()).map((k) => k.idx)
    if (a.join(',') !== b.join(',')) differs = true
  }

  // Drain the whole enabled pool: every Learn is ≤ 5, the final partial chunk fits, then 0 left.
  let q = defaultProgress()
  let clicks = 0
  let everyChunkAtMost5 = true
  while (unlearnedUnits(index, q).length > 0) {
    const chunk = nextLearnChunk(index, q)
    if (chunk.length === 0 || chunk.length > 5) {
      everyChunkAtMost5 = false
      break
    }
    q = applyLearned(q, chunk)
    clicks++
  }
  const allIntroduced = introducedUnits(index, q).length === index.content.units.length
  const noneLeft = learnChunkSize(index, q) === 0 && nextLearnChunk(index, q).length === 0

  // Category / per-kanji selection: disabling a category excludes its kanji; one disabled kanji too.
  const numbersIdx = index.content.units.filter((k) => k.category === 'Numbers').map((k) => k.idx)
  const oneIdx = index.byForm.get('一')!.idx

  const catOff = { ...defaultProgress(), settings: { ...defaultProgress().settings, disabledCategories: ['Numbers'] } }
  const noNumbersInLearn = unlearnedUnits(index, catOff).every((k) => k.category !== 'Numbers')

  const kanjiOff = { ...defaultProgress(), settings: { ...defaultProgress().settings, disabledUnits: [oneIdx] } }
  const oneExcluded = !unlearnedUnits(index, kanjiOff).some((k) => k.idx === oneIdx)
  const othersPresent = unlearnedUnits(index, kanjiOff).some((k) => numbersIdx.includes(k.idx))

  // Re-teach priority: a kanji introduced then dropped below INTRODUCED_LEVEL (kept as a progress
  // entry, unlike never-seen kanji) is guaranteed into the very next Learn set, ahead of new kanji.
  let f = defaultProgress()
  const seed = nextLearnChunk(index, f)
  f = applyLearned(f, seed)
  const forgottenTarget = seed[0].idx
  f = { ...f, units: { ...f.units, [forgottenTarget]: { lvl: INTRODUCED_LEVEL - 1 } } } // simulate a downgrade
  const forgottenBackInPool = unlearnedUnits(index, f).some((k) => k.idx === forgottenTarget)
  const forgottenFlagged =
    forgottenUnits(index, f).some((k) => k.idx === forgottenTarget) && forgottenUnits(index, f).length === 1
  let alwaysReteaches = true
  for (let t = 0; t < 30 && alwaysReteaches; t++) {
    if (!nextLearnChunk(index, f).some((k) => k.idx === forgottenTarget)) alwaysReteaches = false
  }
  // A never-seen kanji (no entry, lvl defaults to 0) is NOT treated as forgotten.
  const freshHasNoForgotten = forgottenUnits(index, defaultProgress()).length === 0

  // "Not now": the skipped kanji is swapped out for the next reserve kanji and re-queued mid-reserve
  // (not next, not last); with an empty reserve it's dropped.
  const twelve = index.content.units.slice(0, 12)
  const cards0 = twelve.slice(0, 5)
  const reserve0 = twelve.slice(5) // 7 in reserve
  const skipTarget = cards0[1].idx
  const s = skipCard(cards0, reserve0, 1, SKIP_REQUEUE_GAP)
  const swappedIn = s.cards[1].idx === reserve0[0].idx
  const leftCards = !s.cards.some((k) => k.idx === skipTarget)
  const requeuePos = s.reserve.findIndex((k) => k.idx === skipTarget)
  const requeuedMiddle = requeuePos > 0 && requeuePos < s.reserve.length - 1
  const dropped = skipCard(cards0, [], 1, SKIP_REQUEUE_GAP)
  const dropWorks = dropped.cards.length === 4 && !dropped.cards.some((k) => k.idx === skipTarget)

  const checks: [string, boolean][] = [
    ['each Learn introduces 5', c1.length === 5 && c2.length === 5 && c3.length === 5],
    ['15 distinct kanji across 3 Learns (no daily cap)', distinct && Object.keys(p.units).length === 15],
    ['selection is random across fresh profiles', differs],
    ['every chunk is ≤ 5', everyChunkAtMost5],
    [`whole pool drained over ${clicks} Learns`, allIntroduced],
    ['nothing left to learn once all introduced', noneLeft],
    ['disabled category excluded from learn pool', noNumbersInLearn],
    ['disabled single kanji excluded; siblings remain', oneExcluded && othersPresent],
    ['forgotten kanji re-enters the unlearned pool', forgottenBackInPool],
    ['forgotten kanji detected (never-seen not counted)', forgottenFlagged && freshHasNoForgotten],
    ['forgotten kanji guaranteed in the next Learn set', alwaysReteaches],
    ['"Not now" swaps in the next reserve kanji', swappedIn && leftCards],
    ['skipped kanji re-queued mid-reserve (not next, not last)', requeuedMiddle],
    ['"Not now" with empty reserve drops the card', dropWorks],
  ]

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: learn selection correct' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
