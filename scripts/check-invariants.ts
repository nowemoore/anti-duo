// Content invariants for the Japanese curriculum — `npm run check:invariants`.
//
// These are the rules that keep the three dbs mutually consistent: every word a learner meets in a
// sentence is one the curriculum actually teaches, and everything the curriculum teaches is
// practised often enough to stick. See dbs/INVARIANTS.md for the rationale and the fix recipes.
//
// Deliberately reads the CSVs directly rather than going through server/content.ts: the loader has
// no notion of ja_kana.csv, `kana_list` or `kana_targets` yet, and this check has to be able to run
// before that work lands.
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import { readLock } from './content-lock'

const ROOT = new URL('../', import.meta.url)

/** Sentences must be >= this many per kanji. */
const MIN_SENTENCES_PER_KANJI = 3
/** Sentences must be >= this many per kana word. */
const MIN_SENTENCES_PER_KANA = 2
/** How many offenders to print before truncating. */
const SAMPLE = 20

/**
 * Grammar the sentences may use without teaching it as vocabulary: copula and helper verbs,
 * demonstratives, and the handful of adverbs that hold sentences together. These are scaffolding — a
 * learner absorbs them from exposure rather than from a card — so they are exempt from both the
 * "must be curriculum vocabulary" and the "must recur" invariants.
 *
 * Okurigana is not listed here: it is never its own token, it rides inside the word it inflects.
 */
const FUNCTION_WORDS = new Set([
  // copula / helper verbs and their inflections
  'する',
  'します',
  'して',
  'した',
  'しました',
  'しています',
  'しないで',
  'しない',
  'ある',
  'あります',
  'ありました',
  'ない',
  'いる',
  'います',
  'いました',
  'ください',
  'なる',
  'なります',
  'なりました',
  // demonstratives
  'この',
  'その',
  'あの',
  'どの',
  'これ',
  'それ',
  'あれ',
  'どれ',
  'ここ',
  'そこ',
  'あそこ',
  'どこ',
  'こちら',
  'そちら',
  'あちら',
  'どちら',
  'どちらも',
  // high-frequency adverbs / connectives
  'とても',
  'よく',
  'また',
  'そう',
  'もう',
  'まだ',
  'いい',
  'かかります',
  'かかりません',
  'わかりません',
])

interface ExampleRef {
  idx: number
  batch?: number
}

interface RawToken {
  kind: 'word' | 'particle'
  ja?: string
  lemma?: string
  kanji?: string[]
  targets?: number[]
  kana_targets?: number[]
}

async function csv(name: string): Promise<Record<string, string>[]> {
  const text = await readFile(new URL(`dbs/${name}`, ROOT), 'utf8')
  const { data, errors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (errors.length) throw new Error(`${name}: ${errors[0].message} (row ${errors[0].row})`)
  return data
}

function json<T>(raw: string | undefined, where: string): T | null {
  try {
    return JSON.parse(raw || 'null') as T
  } catch (e) {
    throw new Error(`${where}: bad JSON — ${(e as Error).message}`)
  }
}

function isKanji(ch: string): boolean {
  const o = ch.codePointAt(0) ?? 0
  return (o >= 0x4e00 && o <= 0x9fff) || (o >= 0x3400 && o <= 0x4dbf) || ch === '々'
}

let failures = 0

/** Print one invariant's verdict, with a truncated sample of what broke it. */
function report(id: string, title: string, offenders: string[], note?: string) {
  if (offenders.length === 0) {
    console.log(`  ok   ${id}  ${title}`)
    return
  }
  failures++
  console.log(`  FAIL ${id}  ${title} — ${offenders.length} offender(s)`)
  for (const o of offenders.slice(0, SAMPLE)) console.log(`         ${o}`)
  if (offenders.length > SAMPLE) console.log(`         ... and ${offenders.length - SAMPLE} more`)
  if (note) console.log(`         -> ${note}`)
}

async function main() {
  const kanjiRows = await csv('ja_kanji.csv')
  const kanaRows = await csv('ja_kana.csv')
  const sentRows = await csv('ja_sentences.csv')
  const wordRows = await csv('ja_words.csv')

  // --- lookups -------------------------------------------------------------
  const kanjiChars = new Set(kanjiRows.map((r) => r.char))
  const kanaWords = new Set(kanaRows.map((r) => r.word))

  // Examples reference ja_words.csv by idx; resolve them so the coverage rules can talk about words.
  const wordByIdx = new Map(wordRows.map((r) => [Number(r.idx), r.word]))
  const danglingWordRef: string[] = []

  /** Every example word the curriculum teaches -> the kanji idx values that teach it. */
  const exampleWords = new Map<string, number[]>()
  for (const r of kanjiRows) {
    const idx = Number(r.idx)
    for (const ref of json<ExampleRef[]>(r.examples, `kanji ${r.idx}.examples`) ?? []) {
      const surface = wordByIdx.get(ref.idx)
      if (surface === undefined) {
        danglingWordRef.push(`kanji ${r.idx} references word idx ${ref.idx}, which does not exist`)
        continue
      }
      const owners = exampleWords.get(surface)
      if (owners) owners.push(idx)
      else exampleWords.set(surface, [idx])
    }
  }

  const kanjiByIdx = new Map(kanjiRows.map((r) => [Number(r.idx), r.char]))
  const kanaByIdx = new Map(kanaRows.map((r) => [Number(r.idx), r.word]))

  // --- sweep the sentences -------------------------------------------------
  /** Surface forms and lemmas seen anywhere in the corpus. */
  const seen = new Set<string>()
  const untaught: string[] = []
  const newKanji = new Map<string, Set<string>>()
  const sentencesPerKanji = new Map<number, number>()
  const sentencesPerKana = new Map<number, number>()
  const danglingIdx: string[] = []
  const absentTarget: string[] = []
  const listMismatch: string[] = []
  const badDeclaredKanji: string[] = []

  for (const row of sentRows) {
    const where = `sentence ${row.id}`
    const rowKanji = json<number[]>(row.kanji_list, `${where}.kanji_list`) ?? []
    const rowKana = json<number[]>(row.kana_list, `${where}.kana_list`) ?? []
    for (const idx of rowKanji) sentencesPerKanji.set(idx, (sentencesPerKanji.get(idx) ?? 0) + 1)
    for (const idx of rowKana) sentencesPerKana.set(idx, (sentencesPerKana.get(idx) ?? 0) + 1)

    const tokenKanji = new Set<number>()
    const tokenKana = new Set<number>()

    for (const t of json<RawToken[]>(row.tokens, `${where}.tokens`) ?? []) {
      if (t.kind !== 'word' || !t.ja) continue
      seen.add(t.ja)
      if (t.lemma) seen.add(t.lemma)

      // S2/S3/S4 — every declared target resolves, and points at something actually present.
      for (const idx of t.targets ?? []) {
        tokenKanji.add(idx)
        const ch = kanjiByIdx.get(idx)
        if (ch === undefined) danglingIdx.push(`${row.id}  targets ${idx} — no such kanji`)
        else if (!t.ja.includes(ch))
          absentTarget.push(`${row.id}  idx ${idx} = ${ch} absent from ${t.ja}`)
      }
      for (const idx of t.kana_targets ?? []) {
        tokenKana.add(idx)
        const w = kanaByIdx.get(idx)
        if (w === undefined) danglingIdx.push(`${row.id}  kana_targets ${idx} — no such kana word`)
        else if (!t.ja.includes(w) && t.lemma !== w)
          absentTarget.push(`${row.id}  idx ${idx} = ${w} absent from ${t.ja} (add a lemma?)`)
      }
      // S5 — the declared kanji array matches the surface, and stays inside the curriculum.
      for (const ch of t.kanji ?? []) {
        if (!t.ja.includes(ch)) badDeclaredKanji.push(`${row.id}  ${ch} not in ${t.ja}`)
        else if (!kanjiChars.has(ch))
          badDeclaredKanji.push(`${row.id}  ${ch} in ${t.ja} is not a curriculum unit`)
      }

      // I1 — the word is taught somewhere, by surface or by lemma.
      const forms = [t.ja, t.lemma].filter(Boolean) as string[]
      const taught = forms.some(
        (f) => exampleWords.has(f) || kanaWords.has(f) || FUNCTION_WORDS.has(f),
      )
      if (!taught) untaught.push(`${row.id}  ${t.ja}${t.lemma ? ` (lemma ${t.lemma})` : ''}`)

      // I5 — no kanji outside the curriculum.
      for (const ch of t.ja) {
        if (!isKanji(ch) || kanjiChars.has(ch)) continue
        const ids = newKanji.get(ch) ?? new Set<string>()
        ids.add(row.id)
        newKanji.set(ch, ids)
      }
    }

    // S2 — the row-level indexes are exactly the union of what the tokens declare.
    const same = (a: Set<number>, b: number[]) =>
      a.size === new Set(b).size && b.every((x) => a.has(x))
    if (!same(tokenKanji, rowKanji))
      listMismatch.push(
        `${row.id}  kanji_list ${JSON.stringify(rowKanji)} vs tokens ${JSON.stringify([...tokenKanji].sort((x, y) => x - y))}`,
      )
    if (!same(tokenKana, rowKana))
      listMismatch.push(
        `${row.id}  kana_list ${JSON.stringify(rowKana)} vs tokens ${JSON.stringify([...tokenKana].sort((x, y) => x - y))}`,
      )
  }

  // --- verdicts ------------------------------------------------------------
  console.log(
    `kanji ${kanjiRows.length}   kana words ${kanaRows.length}   sentences ${sentRows.length}\n`,
  )

  // Structural checks first: these are typos, and they make the coverage numbers below meaningless.
  const dupes: string[] = []
  const seenIdx = new Map<string, Set<number>>()
  for (const [file, rows, key] of [
    ['ja_kanji.csv', kanjiRows, 'char'],
    ['ja_kana.csv', kanaRows, 'word'],
  ] as const) {
    const idxs = new Set<number>()
    const forms = new Set<string>()
    for (const r of rows) {
      const idx = Number(r.idx)
      if (!Number.isInteger(idx)) dupes.push(`${file}  non-integer idx "${r.idx}"`)
      else if (idxs.has(idx)) dupes.push(`${file}  duplicate idx ${idx}`)
      else idxs.add(idx)
      if (forms.has(r[key])) dupes.push(`${file}  duplicate ${key} ${r[key]}`)
      else forms.add(r[key])
    }
    seenIdx.set(file, idxs)
  }
  report('S1', 'unique idx and unique form in ja_kanji.csv / ja_kana.csv', dupes)
  report('S2', 'kanji_list / kana_list match the union of their tokens', listMismatch)
  report('S3', 'every targets / kana_targets idx resolves to a real row', danglingIdx)
  report(
    'S4',
    'every target actually appears in its token',
    absentTarget,
    'for an inflected kana word, add a `lemma` naming the dictionary form',
  )
  report('S5', 'token.kanji lists curriculum characters present in the surface', badDeclaredKanji)


  // S6 — idx is an identity in persisted user data (Progress.units, Settings.disabledUnits, and the
  // Supabase drawings.unit_idx column). Reassigning one silently rewrites a learner's history.
  const lock = await readLock()
  if (!lock) {
    report('S6', 'idx identities match dbs/content.lock.json', [
      'no lock file — run `npm run lock:content` to create it',
    ])
  } else {
    const identity: string[] = []
    for (const [label, live, was, retired] of [
      ['kanji', kanjiByIdx, lock.kanji, lock.kanjiRetired],
      ['kana', kanaByIdx, lock.kana, lock.kanaRetired],
    ] as const) {
      for (const [idx, form] of Object.entries(was))
        if (!live.has(Number(idx)))
          identity.push(`${label} ${idx} = ${form} was removed but is not retired`)
        else if (live.get(Number(idx)) !== form)
          identity.push(`${label} ${idx}: lock says ${form}, csv says ${live.get(Number(idx))}`)
      for (const [idx, form] of Object.entries(retired)) {
        const now = live.get(Number(idx))
        if (now !== undefined && now !== form)
          identity.push(`${label} ${idx} is retired (${form}) but reused for ${now}`)
      }
    }
    report(
      'S6',
      'idx identities match dbs/content.lock.json',
      identity,
      'if the change was deliberate, run `npm run lock:content`; if not, fix the CSV',
    )
  }

  // S7 — the word registry resolves, and its reverse link agrees with the forward one.
  const linkMismatch: string[] = [...danglingWordRef]
  const forward = new Map<number, Set<number>>() // kanji idx -> word idxs, from examples
  for (const r of kanjiRows) {
    forward.set(
      Number(r.idx),
      new Set((json<ExampleRef[]>(r.examples, `kanji ${r.idx}.examples`) ?? []).map((e) => e.idx)),
    )
  }
  for (const r of wordRows) {
    const widx = Number(r.idx)
    for (const kidx of json<number[]>(r.kanji_idxs, `word ${r.idx}.kanji_idxs`) ?? []) {
      if (!forward.has(kidx)) {
        linkMismatch.push(`word ${widx} claims kanji ${kidx}, which does not exist`)
      } else if (!forward.get(kidx)!.has(widx)) {
        linkMismatch.push(`word ${widx} claims kanji ${kidx}, but that kanji does not list it`)
      }
    }
  }
  const reverse = new Map<number, Set<number>>()
  for (const r of wordRows) {
    for (const kidx of json<number[]>(r.kanji_idxs, `word ${r.idx}.kanji_idxs`) ?? []) {
      const set = reverse.get(kidx) ?? new Set<number>()
      set.add(Number(r.idx))
      reverse.set(kidx, set)
    }
  }
  for (const [kidx, wanted] of forward) {
    for (const widx of wanted) {
      if (!reverse.get(kidx)?.has(widx)) {
        linkMismatch.push(`kanji ${kidx} lists word ${widx}, but that word does not claim it`)
      }
    }
  }
  report('S7', 'ja_words.csv resolves and its kanji_idxs agree with examples', linkMismatch)

  report(
    'I1',
    'every sentence word is taught (kanji example, kana word, or function word)',
    untaught,
    'add the word to a kanji’s examples or to ja_kana.csv, or give the token a `lemma` that resolves',
  )

  const unusedExamples: string[] = []
  for (const [word, owners] of exampleWords)
    if (!seen.has(word)) unusedExamples.push(`${word}  (taught by kanji ${owners.join(', ')})`)
  report(
    'I2',
    'every kanji example word appears in >=1 sentence',
    unusedExamples,
    'write a sentence using it, or add `lemma` where it appears inflected',
  )

  const thinKanji: string[] = []
  for (const r of kanjiRows) {
    const n = sentencesPerKanji.get(Number(r.idx)) ?? 0
    if (n < MIN_SENTENCES_PER_KANJI) thinKanji.push(`${r.char} (idx ${r.idx}) — ${n} sentence(s)`)
  }
  report('I3', `every kanji appears in >=${MIN_SENTENCES_PER_KANJI} sentences`, thinKanji)

  const thinKana: string[] = []
  for (const r of kanaRows) {
    if (FUNCTION_WORDS.has(r.word)) continue
    const n = sentencesPerKana.get(Number(r.idx)) ?? 0
    if (n < MIN_SENTENCES_PER_KANA) thinKana.push(`${r.word} (idx ${r.idx}) — ${n} sentence(s)`)
  }
  report('I4', `every kana word appears in >=${MIN_SENTENCES_PER_KANA} sentences`, thinKana)

  const creep = [...newKanji.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([ch, ids]) => `${ch} x${ids.size}  e.g. ${[...ids].slice(0, 4).join(', ')}`)
  report(
    'I5',
    'no kanji outside ja_kanji.csv',
    creep,
    `${newKanji.size} would have to be added to the curriculum, or edited out of the sentences`,
  )

  console.log(
    failures === 0
      ? '\nOK: all invariants hold'
      : `\nFAILED: ${failures} invariant(s) broken — see dbs/INVARIANTS.md`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
