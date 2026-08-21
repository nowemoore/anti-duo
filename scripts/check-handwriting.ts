/**
 * Validates the KanjiVG-derived reference patterns — `npm run check:handwriting`.
 *
 * The question this answers is not "did the generator emit a file" but "will a *human's* strokes
 * match an idealised KanjiVG reference". The 298 bundled draw-patterns are real recorded drawings,
 * so they make a genuine cross-source test set: build a reference set containing only KanjiVG
 * patterns for those same characters, feed the recorded drawings in as input, and see whether the
 * recogniser still names the right character.
 *
 * Needs the KanjiVG cache (`npm run gen:patterns` populates it). Skips rather than fails when it's
 * absent, so this can run offline; it is deliberately not part of `npm run check` for that reason.
 */
import { existsSync } from 'node:fs'
import { CACHE, featuresFor, KC, mapLimit, strokesOf, svgFor, type Point } from './kanjivg'
import { allKana, sameShape } from '../src/lib/kana'
import recorded from '../mobile/src/lang/ja/handwriting/draw-patterns.json'
import generated from '../mobile/src/lang/ja/handwriting/kanjivg-patterns.json'

type Pattern = [string, number, Point[][]]

const recordedPatterns = recorded as unknown as Pattern[]
const generatedPatterns = generated as unknown as Pattern[]

/** Recognise against whatever reference set is currently loaded. Mirrors handwriting/index.ts. */
function recognize(strokes: Point[][], k: number): string[] {
  KC['recordedPattern_hw'] = strokes
  const mn = KC.momentNormalize('hw')
  const feats = KC.extractFeatures(mn, 20)
  const coarse = KC.coarseClassification(feats)
  const out: [string, number][] = []
  for (let i = 0; i < Math.min(coarse.length, 100); i++) {
    const j = coarse[i][0]
    const iLen = KC.refPatterns[j][1]
    const iPat = KC.refPatterns[j][2]
    if (feats.length < iLen + 2 && feats.length > iLen - 3) {
      let m = KC.getMap(iPat, feats, KC.initialDistance)
      m = KC.completeMap(iPat, feats, KC.wholeWholeDistance, m)
      const d = KC.computeWholeDistanceWeighted(iPat, feats, m) / Math.min(feats.length, iPat.length)
      out.push([KC.refPatterns[j][0] as string, d])
    }
  }
  out.sort((a, b) => a[1] - b[1])
  return out.slice(0, k).map((x) => x[0])
}

async function main() {
  const checks: [string, boolean][] = []

  // --- shape of the generated file ----------------------------------------
  const kanaChars = new Set<string>()
  for (const k of allKana()) for (const c of [...k.char]) kanaChars.add(c)
  const genChars = new Set(generatedPatterns.map((p) => p[0]))

  checks.push([
    `every kana codepoint has a pattern (${kanaChars.size})`,
    [...kanaChars].every((c) => genChars.has(c)),
  ])
  checks.push([
    'stroke count matches the stored feature length',
    generatedPatterns.every((p) => p[1] === p[2].length),
  ])
  checks.push([
    'every stroke has at least two points',
    generatedPatterns.every((p) => p[2].every((s) => s.length >= 2)),
  ])
  // momentNormalize centres on a 256 box but legitimately overshoots it (the bundled recorded
  // patterns span roughly -61..341), so the meaningful test is that the generated set occupies the
  // same coordinate space as the recorded one — not that it fits some invented box.
  const span = (set: Pattern[]): [number, number] => {
    let lo = Infinity
    let hi = -Infinity
    for (const p of set) {
      for (const s of p[2]) {
        for (const [x, y] of s) {
          lo = Math.min(lo, x, y)
          hi = Math.max(hi, x, y)
        }
      }
    }
    return [lo, hi]
  }
  const [recLo, recHi] = span(recordedPatterns)
  const [genLo, genHi] = span(generatedPatterns)
  console.log(
    `      coordinate span: recorded ${recLo.toFixed(0)}..${recHi.toFixed(0)}, generated ${genLo.toFixed(0)}..${genHi.toFixed(0)}`,
  )
  checks.push([
    'generated patterns occupy the same coordinate space as recorded ones',
    genLo >= recLo - 20 && genHi <= recHi + 20,
  ])
  // Known stroke counts — a good check that path parsing didn't merge or split strokes.
  const strokeCount = (c: string): number => generatedPatterns.find((p) => p[0] === c)?.[1] ?? -1
  const knownCounts: [string, number][] = [
    ['あ', 3], ['い', 2], ['う', 2], ['え', 2], ['お', 3],
    ['ぬ', 2], ['ん', 1], ['を', 3], ['ア', 2], ['ン', 2], ['ツ', 3],
  ]
  const countsOk = knownCounts.every(([c, n]) => strokeCount(c) === n)
  checks.push(['well-known kana stroke counts are right', countsOk])
  if (!countsOk) {
    for (const [c, n] of knownCounts) {
      if (strokeCount(c) !== n) console.log(`    ${c}: expected ${n}, got ${strokeCount(c)}`)
    }
  }

  // --- cross-source recognition -------------------------------------------
  if (!existsSync(CACHE)) {
    console.log(`SKIP  cross-source recognition (no KanjiVG cache at ${CACHE})`)
  } else {
    // KanjiVG patterns for characters that *also* have a recorded human drawing.
    // Offline by default so `npm run check` never depends on the network; KANJIVG_FETCH=1 populates
    // the cache with the recorded characters the first time.
    const offline = process.env.KANJIVG_FETCH !== '1'
    const sample = recordedPatterns.slice(0, 120)
    const svgs = await mapLimit(sample, 8, (p) => svgFor(p[0], offline))
    const refs: Pattern[] = []
    const testable: Pattern[] = []
    for (let i = 0; i < sample.length; i++) {
      const svg = svgs[i]
      if (!svg) continue
      const strokes = strokesOf(svg)
      if (!strokes.length) continue
      const feats = featuresFor(strokes)
      refs.push([sample[i][0], feats.length, feats])
      testable.push(sample[i])
    }

    if (refs.length < 20) {
      console.log(`SKIP  cross-source recognition (only ${refs.length} cached overlaps)`)
    } else {
      KC.refPatterns = refs
      let top1 = 0
      let top3 = 0
      const misses: string[] = []
      for (const p of testable) {
        // A stored pattern is already normalised features; re-normalising is near-idempotent, so
        // this is a fair stand-in for the raw strokes the app would pass.
        const got = recognize(p[2], 3)
        if (got[0] === p[0]) top1++
        if (got.includes(p[0])) top3++
        else misses.push(`${p[0]}→${got[0] ?? '?'}`)
      }
      const n = testable.length
      const p1 = top1 / n
      const p3 = top3 / n
      console.log(`      cross-source: top-1 ${(p1 * 100).toFixed(0)}%, top-3 ${(p3 * 100).toFixed(0)}% over ${n} recorded drawings`)
      if (misses.length) console.log(`      missed: ${misses.slice(0, 20).join(' ')}`)
      // Human drawings vs idealised references will never be perfect; the app accepts a top-3 hit,
      // so that is the bar that matters.
      checks.push(['recorded human drawings match KanjiVG refs (top-3 ≥ 80%)', p3 >= 0.8])
      checks.push(['…and top-1 is usable (≥ 60%)', p1 >= 0.6])
    }
  }

  // --- kana are discriminable from each other ------------------------------
  // The whole reference set, as the app loads it — kana must stay findable among 500+ patterns.
  KC.refPatterns = [...recordedPatterns, ...generatedPatterns]
  const kanaList = [...kanaChars]
  let kanaTop1 = 0
  let kanaTop3 = 0
  const kanaMisses: string[] = []
  for (const c of kanaList) {
    const pat = generatedPatterns.find((p) => p[0] === c)
    if (!pat) continue
    const got = recognize(pat[2], 3)
    // Grading asks "is this the target?", not "which character is this?", so a shape-equivalent
    // answer counts — small ゃ and full-size や are the same drawing once size is normalised away.
    if (got[0] && sameShape(c, got[0])) kanaTop1++
    if (got.some((g) => sameShape(c, g))) kanaTop3++
    else kanaMisses.push(`${c}→${got.join('')}`)
  }
  const top1Rate = kanaTop1 / kanaList.length
  const top3Rate = kanaTop3 / kanaList.length
  console.log(
    `      kana within the full ${recordedPatterns.length + generatedPatterns.length}-pattern set: top-1 ${(top1Rate * 100).toFixed(0)}%, top-3 ${(top3Rate * 100).toFixed(0)}% over ${kanaList.length} characters`,
  )
  if (kanaMisses.length) console.log(`      missed at top-3: ${kanaMisses.slice(0, 20).join(' ')}`)
  // Grading accepts a top-3 hit, so that is the bar that matters for the feature working.
  checks.push(['kana are discriminable within the full reference set (top-3 ≥ 95%)', top3Rate >= 0.95])

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: handwriting patterns valid' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
