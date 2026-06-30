// Verifies the level-evening selection algorithm — `npm run check:practice`.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { awardDelta, levelSpread, pickTarget } from '../src/lib/practice'
import { applyLearned, introducedKanji, nextLearnChunk, unlearnedKanji } from '../src/lib/study'
import { defaultProgress } from '../shared/constants'
import type { Progress } from '../shared/types'

async function main() {
  const index = buildContentIndex(await loadContent())

  // Introduce 20 kanji (four Learn clicks of 5).
  let p: Progress = defaultProgress()
  for (let s = 0; s < 4; s++) {
    p = applyLearned(p, nextLearnChunk(index, p))
  }
  const introduced = Object.keys(p.kanji).length

  // Simulate 400 always-correct practice iterations with the real selector.
  const counts: Record<number, number> = {}
  let prev: number | null = null
  let repeats = 0
  for (let i = 0; i < 400; i++) {
    const target = pickTarget(index, p, { avoidIdx: prev ?? undefined })
    if (target == null) throw new Error('no target')
    if (target === prev) repeats++
    counts[target] = (counts[target] ?? 0) + 1
    p = awardDelta(p, target, 1)
    prev = target
  }

  const spread = levelSpread(index, p)!
  const everyPractised = Object.keys(p.kanji).every((k) => (counts[Number(k)] ?? 0) > 0)

  // Level-down / re-teach: a miss can drop a kanji below intro, returning it to the learn pool.
  let q: Progress = defaultProgress()
  q = applyLearned(q, nextLearnChunk(index, q))
  const victim = Number(Object.keys(q.kanji)[0])
  q = awardDelta(q, victim, -1) // lvl 1 → 0
  const droppedToUnlearned =
    unlearnedKanji(index, q).some((k) => k.idx === victim) &&
    !introducedKanji(index, q).some((k) => k.idx === victim)
  const flooredAtZero = awardDelta(q, victim, -5).kanji[victim].lvl === 0

  const checks: [string, boolean][] = [
    ['introduced 20 kanji', introduced === 20],
    ['no immediate repeats', repeats === 0],
    ['every introduced kanji practised', everyPractised],
    [`levels stay even (spread max-min ≤ 3, got ${spread.max - spread.min})`, spread.max - spread.min <= 3],
    ['all levels advanced past intro (min ≥ 2)', spread.min >= 2],
    ['miss drops kanji below intro → re-teachable', droppedToUnlearned],
    ['level floored at 0', flooredAtZero],
  ]

  console.log(`  introduced=${introduced}, level min=${spread.min} max=${spread.max}`)
  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: level-evening works' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
