// Verifies the level-evening selection algorithm — `npm run check:practice`.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { awardDelta, levelDeltaFor, levelSpread, pickTarget } from '../src/lib/practice'
import { applyLearned, introducedUnits, nextLearnChunk, unlearnedUnits } from '../src/lib/study'
import { ALL_TASK_TYPES } from '../src/lib/tasks'
import { INTRODUCED_LEVEL, WARMUP_LEVEL, defaultProgress } from '../shared/constants'
import type { Progress } from '../shared/types'

async function main() {
  const index = buildContentIndex(await loadContent())

  // Introduce 20 kanji (four Learn clicks of 5).
  let p: Progress = defaultProgress()
  for (let s = 0; s < 4; s++) {
    p = applyLearned(p, nextLearnChunk(index, p))
  }
  const introduced = Object.keys(p.units).length

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
  const everyPractised = Object.keys(p.units).every((k) => (counts[Number(k)] ?? 0) > 0)

  // Level-down / re-teach: a miss can drop a kanji to the floor, returning it to the learn pool.
  const qBase: Progress = applyLearned(defaultProgress(), nextLearnChunk(index, defaultProgress()))
  const victim = Number(Object.keys(qBase.units)[0])
  const q = awardDelta(qBase, victim, -1) // lvl 1 → 0
  const droppedToUnlearned =
    unlearnedUnits(index, q).some((k) => k.idx === victim) &&
    !introducedUnits(index, q).some((k) => k.idx === victim)
  const flooredAtZero = awardDelta(q, victim, -5).units[victim].lvl === 0

  // A partly-lapsed kanji stays practisable: the classification boundary is the floor, not the level
  // it was introduced at, so there is no band where it is neither practised nor re-taught.
  const limbo = awardDelta(qBase, victim, -0.5)
  const noLimbo =
    introducedUnits(index, limbo).some((k) => k.idx === victim) &&
    !unlearnedUnits(index, limbo).some((k) => k.idx === victim)

  // Warm-up damping: a freshly introduced kanji survives two misses of ANY task type and is only
  // re-taught on the third. Before this, one missed cloze (-0.7) was enough.
  const missesToForget: Record<string, number> = {}
  for (const kind of ALL_TASK_TYPES) {
    let r: Progress = applyLearned(defaultProgress(), nextLearnChunk(index, defaultProgress()))
    const idx = Number(Object.keys(r.units)[0])
    let n = 0
    while (introducedUnits(index, r).some((k) => k.idx === idx) && n < 20) {
      r = awardDelta(r, idx, levelDeltaFor(kind, -1, r.units[idx].lvl))
      n++
    }
    missesToForget[kind] = n
  }
  const survivesTwoMisses = Object.values(missesToForget).every((n) => n >= 3)

  // Gains are never damped — a correct answer still moves the full tuned amount.
  const gainUndamped =
    levelDeltaFor('cloze', 1, INTRODUCED_LEVEL) === levelDeltaFor('cloze', 1, WARMUP_LEVEL + 5)

  const checks: [string, boolean][] = [
    ['introduced 20 kanji', introduced === 20],
    ['no immediate repeats', repeats === 0],
    ['every introduced kanji practised', everyPractised],
    [`levels stay even (spread max-min ≤ 3, got ${spread.max - spread.min})`, spread.max - spread.min <= 3],
    ['all levels advanced past intro (min ≥ 2)', spread.min >= 2],
    ['miss drops kanji to the floor → re-teachable', droppedToUnlearned],
    ['level floored at 0', flooredAtZero],
    ['a partly-lapsed kanji is still practisable (no limbo band)', noLimbo],
    [
      `a new kanji survives 2 misses of every task type (${Object.entries(missesToForget)
        .map(([k, n]) => `${k}:${n}`)
        .join(' ')})`,
      survivesTwoMisses,
    ],
    ['gains are not damped', gainUndamped],
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
