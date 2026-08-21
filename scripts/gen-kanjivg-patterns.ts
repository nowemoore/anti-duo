/**
 * Generates handwriting reference patterns from KanjiVG — `npm run gen:patterns`.
 *
 * The bundled draw-patterns.json came with KanjiCanvas and covers only part of the kanji
 * curriculum, with no kana at all, so kana could be traced but never graded. KanjiVG publishes
 * stroke-by-stroke SVG paths for every kana and every jōyō kanji, which is exactly the missing
 * input.
 *
 * Output goes to a *separate* file rather than being merged into draw-patterns.json, because the
 * two have different licences: KanjiCanvas is MIT, KanjiVG is CC BY-SA 3.0 and requires
 * attribution. Keeping them apart keeps the provenance of each obvious.
 *
 * Yōon (きゃ) get no entry of their own — they're two codepoints, and are graded as two characters
 * the same way multi-kanji words already are.
 *
 * Verify the output with `npm run check:handwriting`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadContent } from '../server/content'
import { allKana } from '../src/lib/kana'
import { CACHE, featuresFor, mapLimit, strokesOf, svgFor, type Point } from './kanjivg'
import existing from '../mobile/src/lang/ja/handwriting/draw-patterns.json'

const OUT = join(process.cwd(), 'mobile/src/lang/ja/handwriting/kanjivg-patterns.json')

/** Two decimals is well below the recognizer's sensitivity and roughly halves the file. */
const round = (n: number): number => Math.round(n * 100) / 100

async function main() {
  const covered = new Set((existing as unknown as [string, number, unknown][]).map((p) => p[0]))

  // Every codepoint the kana table uses, including the small ゃゅょ that yōon are built from.
  const kana = new Set<string>()
  for (const k of allKana()) for (const c of [...k.char]) kana.add(c)

  // Curriculum kanji with no pattern today: these could only ever be traced.
  const content = await loadContent()
  const kanji = new Set<string>()
  for (const u of content.units) {
    for (const c of [...u.form]) if (!covered.has(c) && !kana.has(c)) kanji.add(c)
  }

  const wanted = [...kana, ...kanji]
  console.log(`kana codepoints: ${kana.size}`)
  console.log(`curriculum kanji lacking a pattern: ${kanji.size}`)
  console.log(`fetching ${wanted.length} KanjiVG glyphs (cache: ${CACHE})`)

  const svgs = await mapLimit(wanted, 8, (c) => svgFor(c))

  const patterns: [string, number, Point[][]][] = []
  const missing: string[] = []
  for (let i = 0; i < wanted.length; i++) {
    const char = wanted[i]
    const strokes = svgs[i] ? strokesOf(svgs[i]!) : []
    if (strokes.length === 0) {
      missing.push(char)
      continue
    }
    const feats = featuresFor(strokes)
    patterns.push([char, feats.length, feats.map((s) => s.map(([x, y]) => [round(x), round(y)]))])
  }

  patterns.sort((a, b) => a[0].localeCompare(b[0]))
  writeFileSync(OUT, JSON.stringify(patterns))

  const bytes = readFileSync(OUT).length
  console.log(`wrote ${patterns.length} patterns → ${OUT} (${(bytes / 1024).toFixed(0)} kB)`)
  if (missing.length) console.log(`no KanjiVG glyph for ${missing.length}: ${missing.join(' ')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
