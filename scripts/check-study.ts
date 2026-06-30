// Verifies the Learn selection logic — `npm run check:study`.
// Each Learn introduces up to 5 random, distinct, unlearned kanji from the enabled set; no daily cap.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { applyLearned, introducedKanji, learnChunkSize, nextLearnChunk, unlearnedKanji } from '../src/lib/study'
import { defaultProgress } from '../shared/constants'

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
  while (unlearnedKanji(index, q).length > 0) {
    const chunk = nextLearnChunk(index, q)
    if (chunk.length === 0 || chunk.length > 5) {
      everyChunkAtMost5 = false
      break
    }
    q = applyLearned(q, chunk)
    clicks++
  }
  const allIntroduced = introducedKanji(index, q).length === index.content.kanji.length
  const noneLeft = learnChunkSize(index, q) === 0 && nextLearnChunk(index, q).length === 0

  // Category / per-kanji selection: disabling a category excludes its kanji; one disabled kanji too.
  const numbersIdx = index.content.kanji.filter((k) => k.category === 'Numbers').map((k) => k.idx)
  const oneIdx = index.byChar.get('一')!.idx

  const catOff = { ...defaultProgress(), settings: { ...defaultProgress().settings, disabledCategories: ['Numbers'] } }
  const noNumbersInLearn = unlearnedKanji(index, catOff).every((k) => k.category !== 'Numbers')

  const kanjiOff = { ...defaultProgress(), settings: { ...defaultProgress().settings, disabledKanji: [oneIdx] } }
  const oneExcluded = !unlearnedKanji(index, kanjiOff).some((k) => k.idx === oneIdx)
  const othersPresent = unlearnedKanji(index, kanjiOff).some((k) => numbersIdx.includes(k.idx))

  const checks: [string, boolean][] = [
    ['each Learn introduces 5', c1.length === 5 && c2.length === 5 && c3.length === 5],
    ['15 distinct kanji across 3 Learns (no daily cap)', distinct && Object.keys(p.kanji).length === 15],
    ['selection is random across fresh profiles', differs],
    ['every chunk is ≤ 5', everyChunkAtMost5],
    [`whole pool drained over ${clicks} Learns`, allIntroduced],
    ['nothing left to learn once all introduced', noneLeft],
    ['disabled category excluded from learn pool', noNumbersInLearn],
    ['disabled single kanji excluded; siblings remain', oneExcluded && othersPresent],
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
