// Standalone content validation — `npm run check:content`.
// Confirms every kanji has examples (enforced during load) and resolves to ≥1 sentence.
import { loadContent, validateContent } from '../server/content'

async function main() {
  const store = await loadContent()
  const report = validateContent(store)

  console.log(`kanji:     ${report.kanjiCount}`)
  console.log(`sentences: ${report.sentenceCount}`)

  // Coverage stats: how many sentences each kanji appears in.
  let min = Infinity
  let max = 0
  let total = 0
  for (const k of store.units) {
    const n = store.sentencesForUnit.get(k.idx)?.length ?? 0
    min = Math.min(min, n)
    max = Math.max(max, n)
    total += n
  }
  console.log(
    `coverage:  min ${min}, max ${max}, avg ${(total / store.units.length).toFixed(1)} sentences/kanji`,
  )

  let ok = true
  if (report.kanjiWithoutSentences.length) {
    ok = false
    console.error(`FAIL: kanji with no sentences: ${report.kanjiWithoutSentences.join(', ')}`)
  }
  if (report.warnings.length) {
    ok = false
    for (const w of report.warnings) console.error(`WARN: ${w}`)
  }

  console.log(ok ? 'OK: content valid' : 'FAILED: see issues above')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
