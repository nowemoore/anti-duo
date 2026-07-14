// Arabic content loader — the AR counterpart of the JA loader in content.ts. Reads the root/sentence
// CSVs (dbs/ar_roots.csv, dbs/ar_sentences.csv), whose schema differs from Japanese (triliteral roots
// with staged batches, voweled forms, broken plurals, no distractor/category columns), and adapts them
// into the neutral Content model. Anything Arabic-specific (voweled, accept, plural, lemma, inflected)
// rides in the `extra` bag; the engine never looks inside it. Emits `lang: 'ar'`.
import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import type { Content, ParticleToken, Sentence, Token, Unit, Word, WordToken } from '../shared/types'

/** Project root (this file lives in server/, one level down). */
const ROOT = new URL('../', import.meta.url)

/** How many synthesized distractor words to attach to each root (for the which-words task). */
const DISTRACTORS_PER_UNIT = 6
/** Roots per difficulty batch — derived from teaching order (idx) since the CSV has no batch column. */
const ROOTS_PER_BATCH = 20
/** Every root lands in one topical group (the AR data carries no category column). */
const DEFAULT_CATEGORY = 'Core roots'

class ContentError extends Error {}

/** One raw example/distractor word as stored in the batch cells of ar_roots.csv. */
interface RawArWord {
  word: string
  voweled?: string
  en: string
  plural?: { word: string; voweled?: string; forms?: string[] }
  accept?: string[]
  forms?: string[]
}

/** One raw sentence token as stored in the tokens cell of ar_sentences.csv. */
type RawArToken =
  | { kind: 'func'; ar: string; voweled?: string; en?: string; roots?: number[] }
  | {
      kind: 'word'
      ar: string
      voweled?: string
      en: string
      roots?: number[]
      lemma?: string
      inflected?: string
    }

async function parseCsv(fileName: string): Promise<Record<string, string>[]> {
  const text = await readFile(new URL(`dbs/${fileName}`, ROOT), 'utf8')
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  if (result.errors.length) {
    const first = result.errors[0]
    throw new ContentError(`CSV parse error in ${fileName}: ${first.message} (row ${first.row})`)
  }
  return result.data
}

function parseJsonField<T>(raw: string | undefined, where: string): T {
  if (raw == null || raw === '') throw new ContentError(`Missing field at ${where}`)
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    throw new ContentError(`Invalid JSON at ${where}: ${(e as Error).message}`)
  }
}

/** "writing, recording" -> ["writing", "recording"] (Arabic core meanings separate on commas/semicolons). */
function splitGloss(s: string): string[] {
  return s
    .split(/[;,]/)
    .map((m) => m.trim())
    .filter(Boolean)
}

/** Adapt a raw batch word into the neutral Word, stashing the Arabic-specific fields in `extra`. */
function toWord(raw: RawArWord, batch: number): Word {
  const extra: Record<string, unknown> = { batch }
  if (raw.voweled) extra.voweled = raw.voweled
  if (raw.accept?.length) extra.accept = raw.accept
  if (raw.forms?.length) extra.forms = raw.forms
  if (raw.plural) {
    // buildPlural expects a string; keep the voweled/alternate forms alongside for display.
    extra.plural = raw.plural.word
    if (raw.plural.voweled) extra.pluralVoweled = raw.plural.voweled
    if (raw.plural.forms?.length) extra.pluralForms = raw.plural.forms
  }
  return {
    word: raw.word,
    reading: raw.voweled || raw.word, // the "reading" of an Arabic word is its vocalised (voweled) form
    meaning: raw.en,
    extra,
  }
}

function parseRootRow(row: Record<string, string>): Unit {
  const idx = Number(row.idx)
  if (!Number.isInteger(idx)) throw new ContentError(`Bad idx "${row.idx}"`)
  const where = `root idx=${idx}`
  const form = row.root_ar?.trim()
  if (!form) throw new ContentError(`Empty root_ar at ${where}`)
  const examples: Word[] = []
  for (const [tier, col] of [
    [1, row.batch1],
    [2, row.batch2],
    [3, row.batch3],
  ] as const) {
    const words = parseJsonField<RawArWord[]>(col || '[]', `${where}.batch${tier}`)
    for (const w of words) examples.push(toWord(w, tier))
  }
  if (examples.length === 0) throw new ContentError(`No examples at ${where}`)
  const extra: Record<string, unknown> = {}
  if (row.root_translit?.trim()) extra.translit = row.root_translit.trim()
  return {
    idx,
    form,
    batch: Math.floor((idx - 1) / ROOTS_PER_BATCH) + 1,
    category: DEFAULT_CATEGORY,
    gloss: splitGloss(row.core_meaning ?? ''),
    examples,
    distractors: [], // synthesized after all roots are loaded (see attachDistractors)
    extra,
  }
}

/**
 * Fill each root's `distractors` with real words drawn from *other* roots — plausible fakes for the
 * which-words task (they're genuine Arabic words, just not built on this root). Deterministic: the
 * pick window is offset by idx so the build is reproducible.
 */
function attachDistractors(units: Unit[]): void {
  const pool: { word: Word; owner: number }[] = units.flatMap((u) =>
    u.examples.map((word) => ({ word, owner: u.idx })),
  )
  if (pool.length === 0) return
  for (const u of units) {
    const own = new Set(u.examples.map((e) => e.word))
    const seen = new Set<string>()
    const picks: Word[] = []
    let j = (u.idx * 7) % pool.length
    for (let guard = 0; guard < pool.length && picks.length < DISTRACTORS_PER_UNIT; guard++) {
      const cand = pool[j]
      j = (j + 1) % pool.length
      if (cand.owner === u.idx || own.has(cand.word.word) || seen.has(cand.word.word)) continue
      seen.add(cand.word.word)
      picks.push(cand.word)
    }
    u.distractors = picks
  }
}

/** Adapt a raw sentence token to the neutral Token model; function words become verbatim particles. */
function toToken(raw: RawArToken, formByIdx: Map<number, string>): Token {
  if (raw.kind === 'func') {
    const p: ParticleToken = { kind: 'particle', surface: raw.ar }
    return p
  }
  const roots = raw.roots ?? []
  const extra: Record<string, unknown> = {}
  if (raw.voweled) extra.voweled = raw.voweled
  if (raw.lemma) extra.lemma = raw.lemma
  if (raw.inflected) extra.inflected = raw.inflected
  const w: WordToken = {
    kind: 'word',
    surface: raw.ar,
    reading: raw.voweled || raw.ar,
    gloss: raw.en,
    units: roots.map((idx) => formByIdx.get(idx)).filter((f): f is string => !!f),
    targets: roots,
    extra,
  }
  return w
}

function parseSentenceRow(row: Record<string, string>, formByIdx: Map<number, string>): Sentence {
  const where = `sentence id=${row.id}`
  return {
    id: row.id,
    unitList: parseJsonField<number[]>(row.root_list, `${where}.root_list`),
    tokens: parseJsonField<RawArToken[]>(row.tokens, `${where}.tokens`).map((t) => toToken(t, formByIdx)),
  }
}

/** Read + adapt the Arabic CSVs into the neutral Content payload (lang: 'ar'). */
export async function loadArContent(): Promise<Content> {
  const [rootRows, sentenceRows] = await Promise.all([
    parseCsv('ar_roots.csv'),
    parseCsv('ar_sentences.csv'),
  ])
  const units = rootRows.map(parseRootRow).sort((a, b) => a.idx - b.idx)
  attachDistractors(units)
  const formByIdx = new Map(units.map((u) => [u.idx, u.form]))
  const sentences = sentenceRows.map((r) => parseSentenceRow(r, formByIdx))
  return {
    lang: 'ar',
    units,
    sentences,
    // Breakdown maps are JA-only (radical/components); Arabic has no equivalent.
    kanjiMeanings: {},
    kanjiRadicals: {},
    kanjiComponents: {},
  }
}
