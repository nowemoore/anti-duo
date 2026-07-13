// Pre-builds the static content payload for the no-backend demo — `npm run gen:content`.
// Mirrors GET /api/content exactly: runs the same loader and writes the JSON the static build
// fetches at runtime. Regenerated automatically by `npm run build:static`.
import { mkdir, writeFile } from 'node:fs/promises'
import { getContent } from '../server/content'

const OUT_DIR = new URL('../public/', import.meta.url)
const OUT = new URL('content.json', OUT_DIR)

async function main() {
  const { units, sentences, kanjiMeanings, kanjiRadicals, kanjiComponents } = await getContent()
  const content = { units, sentences, kanjiMeanings, kanjiRadicals, kanjiComponents }
  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT, JSON.stringify(content), 'utf8')
  console.log(
    `[gen:content] wrote ${units.length} units, ${sentences.length} sentences → public/content.json`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
