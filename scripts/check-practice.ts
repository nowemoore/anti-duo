// Verifies the level-evening selection algorithm — `npm run check:practice`.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { awardDelta, levelDeltaFor, levelSpread, markSeen, pickTarget } from '../src/lib/practice'
import { applyLearned, introducedUnits, nextLearnChunk, unlearnedUnits } from '../src/lib/study'
import { ALL_TASK_TYPES } from '../src/lib/tasks'
import { EXPLORE_RATE, INTRODUCED_LEVEL, WARMUP_LEVEL, defaultProgress } from '../shared/constants'
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
    // exploreRate 0: this asserts the level-weighted behaviour, and the exploration slice would
    // otherwise inject uniform picks that legitimately repeat the previous target and widen spread.
    const pick = pickTarget(index, p, { avoidIdx: prev ?? undefined, exploreRate: 0 })
    if (pick == null) throw new Error('no target')
    const target = pick.idx
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

  // --- exploration slice --------------------------------------------------
  // A fraction of picks ignore the level weighting, so retention analysis has review gaps the
  // scheduler didn't choose. Rate 0 and 1 must be absolute: the checks above rely on 0 disabling it.
  const neverRandom = Array.from({ length: 200 }, () =>
    pickTarget(index, p, { exploreRate: 0 })!.random,
  ).every((r) => r === false)
  const alwaysRandom = Array.from({ length: 200 }, () =>
    pickTarget(index, p, { exploreRate: 1 })!.random,
  ).every((r) => r === true)
  const N = 20000
  const observed = Array.from({ length: N }, () => pickTarget(index, p)!.random).filter(Boolean).length / N
  // Wide band: this is a rate check, not a randomness test.
  const rateAboutRight = Math.abs(observed - EXPLORE_RATE) < EXPLORE_RATE / 2

  // An explored pick must still be a legal target, not just any index.
  const poolIdx = new Set(introducedUnits(index, p).map((k) => k.idx))
  const exploredInPool = Array.from({ length: 500 }, () =>
    pickTarget(index, p, { exploreRate: 1 })!.idx,
  ).every((i) => poolIdx.has(i))

  // --- unit record is preserved across writes -------------------------------
  // awardDelta used to write `{ lvl }` alone, dropping everything else on the record.
  const seeded: Progress = {
    ...qBase,
    units: { ...qBase.units, [victim]: { lvl: 3, seenBatches: 2, lastSeenAt: '2026-01-01T00:00:00.000Z' } },
  }
  const afterAward = awardDelta(seeded, victim, 1).units[victim]
  const keepsBatches = afterAward.seenBatches === 2 && afterAward.lastSeenAt === '2026-01-01T00:00:00.000Z'

  const stamped = markSeen(seeded, victim, '2026-06-01T00:00:00.000Z').units[victim]
  const marksSeen = stamped.lastSeenAt === '2026-06-01T00:00:00.000Z' && stamped.lvl === 3 && stamped.seenBatches === 2

  // A unit never practised has no timestamp to report as a previous review.
  const freshHasNoSeen = qBase.units[victim].lastSeenAt === undefined

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
    ['exploreRate 0 never explores', neverRandom],
    ['exploreRate 1 always explores', alwaysRandom],
    [`explore rate ≈ ${EXPLORE_RATE} (observed ${observed.toFixed(3)})`, rateAboutRight],
    ['an explored pick is still a legal target', exploredInPool],
    ['awardDelta preserves seenBatches / lastSeenAt', keepsBatches],
    ['markSeen stamps recency without touching the rest', marksSeen],
    ['an unpractised unit has no lastSeenAt', freshHasNoSeen],
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
