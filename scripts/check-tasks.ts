// Verifies practice task generation — `npm run check:tasks`.
import { loadContent } from '../server/content'
import { buildContentIndex } from '../src/lib/content'
import {
  ALL_TASK_TYPES,
  CLOZE_OPTIONS,
  checkChoice,
  checkTypeWord,
  generateTask,
  hasAnyTask,
  isWhichWordsPerfect,
  scoreWhichWords,
  WHICH_WORDS_OPTIONS,
  type ChoiceTask,
  type TypeWordTask,
  type WhichWordsTask,
} from '../src/lib/tasks'

async function main() {
  const index = buildContentIndex(await loadContent())
  const allIdx = index.content.kanji.map((k) => k.idx)
  const ctx = { studySet: allIdx } // cloze distractors drawn from the full set in tests
  const checks: [string, boolean][] = []

  // Every kanji supports at least one task type.
  checks.push(['all 100 kanji have ≥1 feasible task', allIdx.every((i) => hasAnyTask(index, i))])

  // Feasibility per type (informational + sanity that each type works somewhere).
  for (const type of ALL_TASK_TYPES) {
    const n = allIdx.filter((i) => generateTask(index, i, type, ctx) !== null).length
    console.log(`  ${type}: feasible for ${n}/100 kanji`)
    checks.push([`${type} feasible for ≥1 kanji`, n > 0])
  }

  // Invariants over a sweep of generated tasks.
  let choiceOk = true
  let clozeOk = true
  let whichOk = true
  let typeOk = true
  for (const i of allIdx) {
    for (const type of ALL_TASK_TYPES) {
      const task = generateTask(index, i, type, ctx)
      if (!task) continue
      if (task.targetIdx !== i) choiceOk = false
      if (task.kind === 'cloze' || task.kind === 'pick-reading' || task.kind === 'pick-meaning') {
        const c = task as ChoiceTask
        const correctCount = c.options.filter((o) => o.correct).length
        if (correctCount !== 1) choiceOk = false
        if (c.options.length < 3) choiceOk = false
        // The correct option must be checkable.
        const correctIdx = c.options.findIndex((o) => o.correct)
        if (!checkChoice(c, correctIdx)) choiceOk = false
        // Focus token is a word that lists the target as a blankable target.
        const tok = c.sentence.tokens[c.tokenIndex]
        if (tok.kind !== 'word' || !tok.targets.includes(i)) choiceOk = false
        // Cloze: 4 kanji-char options, correct == target char, char present in the focus word.
        if (c.kind === 'cloze') {
          if (c.options.length !== CLOZE_OPTIONS) clozeOk = false
          if (c.blankChar !== index.byIdx.get(i)!.char) clozeOk = false
          if (c.options[correctIdx].label !== index.byIdx.get(i)!.char) clozeOk = false
          if (tok.kind === 'word' && !tok.ja.includes(c.blankChar!)) clozeOk = false
          if (new Set(c.options.map((o) => o.label)).size !== CLOZE_OPTIONS) clozeOk = false // distinct
        }
      } else if (task.kind === 'which-words') {
        const w = task as WhichWordsTask
        const correctSet = new Set(w.options.map((o, idx) => (o.correct ? idx : -1)).filter((x) => x >= 0))
        if (w.options.length !== WHICH_WORDS_OPTIONS) whichOk = false // exactly 4 options
        if (correctSet.size === 0 || correctSet.size === w.options.length) whichOk = false // ≥1 real + ≥1 fake
        if (w.options.some((o) => !o.meaning)) whichOk = false // every option carries a meaning
        if (!isWhichWordsPerfect(w, correctSet)) whichOk = false
        if (scoreWhichWords(w, correctSet) !== 1) whichOk = false // perfect selection scores +1
        if (scoreWhichWords(w, new Set()) >= 1) whichOk = false // empty selection scores less
      } else {
        const t = task as TypeWordTask
        if (!checkTypeWord(t, t.reading)) typeOk = false
        if (checkTypeWord(t, t.reading + 'x')) typeOk = false
      }
    }
  }
  checks.push(['choice tasks: exactly 1 correct, ≥3 options, focus matches target', choiceOk])
  checks.push(['cloze: 4 distinct kanji options, correct = target char in word', clozeOk])
  checks.push(['which-words: 4 options, meanings, ±0.25 scoring (perfect=+1)', whichOk])
  checks.push(['type-word: reading matches, wrong input fails', typeOk])

  let ok = true
  for (const [name, pass] of checks) {
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}`)
    if (!pass) ok = false
  }
  console.log(ok ? 'OK: task generation correct' : 'FAILED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
