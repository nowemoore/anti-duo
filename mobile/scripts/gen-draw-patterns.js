// Regenerates the handwriting recognizer module + trimmed reference patterns.
//
//   node scripts/gen-draw-patterns.js
//
// Run this after adding kanji to public/content.json so the draw task can recognize them.
// It downloads KanjiCanvas's recognizer + reference data (cached under scripts/.kanjicanvas-cache),
// wraps the recognizer for React Native, and writes only the patterns for characters in the dataset.
//
// KanjiCanvas is MIT-licensed (c) Dominik Klein — https://github.com/asdfjkl/kanjicanvas

const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.resolve(__dirname, '..')
const CACHE = path.join(__dirname, '.kanjicanvas-cache')
const HW = path.join(ROOT, 'src', 'lib', 'handwriting')
const BASE = 'https://raw.githubusercontent.com/asdfjkl/kanjicanvas/master/docs/resources/javascript'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`${url} -> HTTP ${res.statusCode}`))
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      })
      .on('error', (e) => {
        fs.rmSync(dest, { force: true })
        reject(e)
      })
  })
}

async function ensure(name) {
  const dest = path.join(CACHE, name)
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(CACHE, { recursive: true })
    process.stdout.write(`downloading ${name}...\n`)
    await download(`${BASE}/${name}`, dest)
  }
  return dest
}

async function main() {
  const canvasSrc = fs.readFileSync(await ensure('kanji-canvas.js'), 'utf8')
  const refSrc = fs.readFileSync(await ensure('ref-patterns.js'), 'utf8')

  // 1) Wrap the recognizer as a headless RN module.
  const wrapped = canvasSrc.replace(
    '}(window, document));',
    '}(typeof global !== "undefined" ? global : this, { addEventListener: function () {} }));',
  )
  fs.mkdirSync(HW, { recursive: true })
  fs.writeFileSync(
    path.join(HW, 'kanjicanvas.ts'),
    `// @ts-nocheck
/* eslint-disable */
// Vendored from KanjiCanvas (MIT (c) Dominik Klein), headlessified for React Native.
// Recognition core only; DOM drawing funcs are defined but never called. Regenerated, do not edit.
const KanjiCanvas: any = {};
${wrapped}
export default KanjiCanvas
`,
  )

  // 2) Trim reference patterns to the characters used by the dataset.
  global.window = global
  global.document = { addEventListener() {} }
  // eslint-disable-next-line no-eval
  eval(canvasSrc)
  const KC = global.KanjiCanvas
  // eslint-disable-next-line no-eval
  eval(refSrc)
  const refByChar = new Map(KC.refPatterns.map((p) => [p[0], p]))

  const content = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'public', 'content.json'), 'utf8'))
  const need = new Set()
  for (const k of content.kanji) {
    need.add(k.char)
    for (const ex of k.examples || []) for (const ch of ex.word) need.add(ch)
  }
  const covered = [...need].filter((c) => refByChar.has(c))
  const missing = [...need].filter((c) => !refByChar.has(c))
  const trimmed = covered.map((c) => refByChar.get(c))
  fs.writeFileSync(path.join(HW, 'draw-patterns.json'), JSON.stringify(trimmed))

  const kb = (fs.statSync(path.join(HW, 'draw-patterns.json')).size / 1024).toFixed(0)
  console.log(`draw-patterns.json: ${trimmed.length} kanji (${kb} KB)`)
  console.log(`uncovered (not drawable, mostly kana): ${missing.length}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
