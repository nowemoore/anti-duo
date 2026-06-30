// Verifies the learned-aware display rule — `npm run check:render`.
// A content word is English until ≥1 of its kanji is learned, then Japanese (furigana).
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import { contentTokenDisplay, isCharLearned } from '../src/lib/learned'
import { defaultProgress } from '../shared/constants'
import type { Progress, WordToken } from '../shared/types'

function learn(progress: Progress, idx: number): Progress {
  return { ...progress, kanji: { ...progress.kanji, [idx]: { lvl: 1 } } }
}

async function main() {
  const index = buildContentIndex(await loadContent())

  // s001: 私 / は / 学生 / です  — 学生 is a two-kanji content word (学 + 生).
  const s = index.content.sentences.find((x) => x.id === 's001')
  if (!s) throw new Error('s001 missing')
  const watashi = s.tokens[0] as WordToken // 私
  const gakusei = s.tokens[2] as WordToken // 学生
  const idxOf = (c: string) => index.byChar.get(c)!.idx

  const display = (tok: WordToken, p: Progress) =>
    contentTokenDisplay(tok, (c) => isCharLearned(c, index, p))

  const checks: [string, boolean][] = []
  let p = defaultProgress()

  checks.push(['私 english when nothing learned', display(watashi, p) === 'english'])
  checks.push(['学生 english when nothing learned', display(gakusei, p) === 'english'])

  p = learn(p, idxOf('私'))
  checks.push(['私 japanese once 私 learned', display(watashi, p) === 'japanese'])
  checks.push(['学生 still english (学/生 unlearned)', display(gakusei, p) === 'english'])

  p = learn(p, idxOf('学')) // learn only ONE of the two kanji
  checks.push(['学生 japanese once 学 learned (≥1 rule)', display(gakusei, p) === 'japanese'])

  // No tracked kanji: kana-only words stay Japanese; words with untracked kanji show English.
  const aru: WordToken = { kind: 'word', ja: 'ある', reading: 'ある', en: 'is', kanji: [], targets: [] }
  const shima: WordToken = { kind: 'word', ja: '島', reading: 'しま', en: 'island', kanji: [], targets: [] }
  checks.push(['kana-only word (ある) is japanese', display(aru, p) === 'japanese'])
  checks.push(['untracked-kanji word (島) is english', display(shima, p) === 'english'])

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: render rules correct' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
