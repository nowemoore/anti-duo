import KanjiCanvasRaw from './kanjicanvas'
import patterns from './draw-patterns.json'

// The vendored recognizer and its pattern data are dynamically typed; keep `any` at the boundary.
const pats = patterns as unknown as [string, number, unknown][]
const KC: any = KanjiCanvasRaw
KC.refPatterns = pats

/** Characters we have a reference pattern for (kanji only — kana are not covered). */
const covered = new Set(pats.map((p) => p[0]))

export type RawPoint = { x: number; y: number }
export type RawStroke = RawPoint[]

const toXY = (s: RawStroke): [number, number][] => s.map((p) => [p.x, p.y])

/** Whether a word can be an auto-graded draw target: 1–maxKanji characters, all with patterns. */
export function drawable(word: string, maxKanji = 3): boolean {
  const chars = [...word]
  return chars.length >= 1 && chars.length <= maxKanji && chars.every((c) => covered.has(c))
}

/** Top-K candidate characters for a single character's strokes (best first). */
export function recognize(strokes: RawStroke[], k = 5): string[] {
  if (!strokes.length) return []
  KC['recordedPattern_hw'] = strokes.map(toXY)
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

/** Split strokes into `n` left-to-right groups by the largest gaps in mean-x (guided by known count). */
function segmentByX(strokes: RawStroke[], n: number): RawStroke[][] {
  const w = strokes.map((s) => ({ s, mx: s.reduce((a, p) => a + p.x, 0) / s.length }))
  w.sort((a, b) => a.mx - b.mx)
  if (n <= 1) return [w.map((x) => x.s)]
  const gaps: { i: number; g: number }[] = []
  for (let i = 1; i < w.length; i++) gaps.push({ i, g: w[i].mx - w[i - 1].mx })
  gaps.sort((a, b) => b.g - a.g)
  const cuts = new Set(gaps.slice(0, n - 1).map((x) => x.i))
  const groups: RawStroke[][] = []
  let cur: RawStroke[] = []
  w.forEach((x, i) => {
    if (cuts.has(i)) {
      groups.push(cur)
      cur = []
    }
    cur.push(x.s)
  })
  groups.push(cur)
  return groups
}

export interface WordScore {
  correct: boolean
  marks: { char: string; ok: boolean }[]
}

/**
 * Grade a whole-word drawing: segment into its (known) characters left-to-right and verify each
 * against the recognizer's top-K. Assumes an all-kanji word (see `drawable`).
 */
export function scoreWord(word: string, strokes: RawStroke[], topK = 3): WordScore {
  const chars = [...word]
  if (strokes.length < chars.length) {
    return { correct: false, marks: chars.map((c) => ({ char: c, ok: false })) }
  }
  const groups = segmentByX(strokes, chars.length)
  const marks = chars.map((char, i) => ({ char, ok: recognize(groups[i], topK).includes(char) }))
  return { correct: marks.every((m) => m.ok), marks }
}
