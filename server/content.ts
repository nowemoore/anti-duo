import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import type { Kanji, Sentence, Token, Word } from '../shared/types'

/** Project root (this file lives in server/, one level down). */
const ROOT = new URL('../', import.meta.url)

export interface ContentStore {
  kanji: Kanji[]
  sentences: Sentence[]
  byIdx: Map<number, Kanji>
  byChar: Map<string, Kanji>
  /** kanji idx -> sentences that contain it. */
  sentencesForKanji: Map<number, Sentence[]>
  /** char -> English meaning, for kanji used by the curriculum, example words, radical, components. */
  kanjiMeanings: Record<string, string>
  /** curriculum kanji char -> its classifying radical char. */
  kanjiRadicals: Record<string, string>
  /** curriculum kanji char -> its component chars (excluding itself and its radical). */
  kanjiComponents: Record<string, string[]>
}

/** Matches a single CJK ideograph (kanji), excluding kana. */
const KANJI_CHAR = /[㐀-䶿一-鿿豈-﫿]/

class ContentError extends Error {}

function parseJsonField<T>(raw: string | undefined, where: string): T {
  if (raw == null || raw === '') throw new ContentError(`Missing field at ${where}`)
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    throw new ContentError(`Invalid JSON at ${where}: ${(e as Error).message}`)
  }
}

function parseKanjiRow(row: Record<string, string>): Kanji {
  const idx = Number(row.idx)
  if (!Number.isInteger(idx)) throw new ContentError(`Bad idx "${row.idx}"`)
  const where = `kanji idx=${idx}`
  const batch = Number(row.batch)
  const kanji: Kanji = {
    idx,
    char: row.char,
    batch: Number.isFinite(batch) && batch >= 1 ? batch : 1,
    category: row.category?.trim() || 'Everyday & Misc',
    gloss: splitMeanings(row.meanings ?? ''),
    examples: parseJsonField<Word[]>(row.examples, `${where}.examples`),
    distractors: parseJsonField<Word[]>(row.distractors, `${where}.distractors`),
  }
  if (!kanji.char) throw new ContentError(`Empty char at ${where}`)
  if (kanji.examples.length === 0) throw new ContentError(`No examples at ${where}`)
  return kanji
}

function parseSentenceRow(row: Record<string, string>): Sentence {
  const where = `sentence id=${row.id}`
  return {
    id: row.id,
    kanjiList: parseJsonField<number[]>(row.kanji_list, `${where}.kanji_list`),
    tokens: parseJsonField<Token[]>(row.tokens, `${where}.tokens`),
  }
}

async function parseCsv(fileName: string): Promise<Record<string, string>[]> {
  const text = await readFile(new URL(`dbs/${fileName}`, ROOT), 'utf8')
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (result.errors.length) {
    const first = result.errors[0]
    throw new ContentError(`CSV parse error in ${fileName}: ${first.message} (row ${first.row})`)
  }
  return result.data
}

/**
 * char→meaning lookup from allkanji_meanings.csv — used only to label radical / component / example
 * characters that aren't curriculum kanji (curriculum meanings come from kanji.csv and override these).
 */
async function loadAllkanjiMeanings(): Promise<Map<string, string>> {
  const text = await readFile(new URL('dbs/allkanji_meanings.csv', ROOT), 'utf8')
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  const map = new Map<string, string>()
  for (const r of data) {
    const char = r.kanji?.trim()
    const meaning = (r.meanings ?? '').trim()
    if (char && meaning) map.set(char, meaning)
  }
  return map
}

/** char→meaning / char→radical / char→components maps, read from the kanji.csv rows. */
function buildDictMaps(rows: Record<string, string>[]): {
  meanings: Map<string, string>
  radicals: Map<string, string>
  components: Map<string, string[]>
} {
  const meanings = new Map<string, string>()
  const radicals = new Map<string, string>()
  const components = new Map<string, string[]>()
  for (const r of rows) {
    const char = r.char?.trim()
    if (!char) continue
    const meaning = (r.meanings ?? '').trim()
    if (meaning) meanings.set(char, meaning)
    const radical = (r.radical ?? '').trim()
    if (radical) radicals.set(char, radical)
    const comps = (r.components ?? '').trim().split(/\s+/).filter(Boolean)
    if (comps.length) components.set(char, comps)
  }
  return { meanings, radicals, components }
}

/** "love; affection; favourite" -> ["love", "affection", "favourite"]. */
function splitMeanings(s: string): string[] {
  return s
    .split(';')
    .map((m) => m.trim())
    .filter(Boolean)
}

/** A char->meaning map covering every kanji used by the curriculum, examples, radical, components. */
function buildKanjiMeanings(
  kanji: Kanji[],
  meanings: Map<string, string>,
  radicals: Map<string, string>,
  components: Map<string, string[]>,
): Record<string, string> {
  const needed = new Set<string>()
  for (const k of kanji) {
    needed.add(k.char)
    for (const ex of k.examples) {
      for (const ch of ex.word) if (KANJI_CHAR.test(ch)) needed.add(ch)
    }
    const rad = radicals.get(k.char)
    if (rad) needed.add(rad)
    for (const c of components.get(k.char) ?? []) needed.add(c)
  }
  const out: Record<string, string> = {}
  for (const ch of needed) {
    const m = meanings.get(ch)
    if (m) out[ch] = m
  }
  return out
}

/** curriculum kanji char -> its radical char. */
function buildKanjiRadicals(kanji: Kanji[], radicals: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of kanji) {
    const rad = radicals.get(k.char)
    if (rad) out[k.char] = rad
  }
  return out
}

/** curriculum kanji char -> its component chars (excluding the kanji itself and its radical). */
function buildKanjiComponents(
  kanji: Kanji[],
  radicals: Map<string, string>,
  components: Map<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const k of kanji) {
    const rad = radicals.get(k.char)
    const comps = (components.get(k.char) ?? []).filter((c) => c !== k.char && c !== rad)
    if (comps.length) out[k.char] = comps
  }
  return out
}

/** Coverage issues that are worth surfacing but not fatal. */
export interface ContentReport {
  kanjiCount: number
  sentenceCount: number
  kanjiWithoutSentences: number[]
  warnings: string[]
}

function buildIndexes(kanji: Kanji[], sentences: Sentence[]): {
  byIdx: Map<number, Kanji>
  byChar: Map<string, Kanji>
  sentencesForKanji: Map<number, Sentence[]>
} {
  const byIdx = new Map<number, Kanji>()
  const byChar = new Map<string, Kanji>()
  for (const k of kanji) {
    byIdx.set(k.idx, k)
    byChar.set(k.char, k)
  }
  const sentencesForKanji = new Map<number, Sentence[]>()
  for (const s of sentences) {
    for (const idx of s.kanjiList) {
      const list = sentencesForKanji.get(idx)
      if (list) list.push(s)
      else sentencesForKanji.set(idx, [s])
    }
  }
  return { byIdx, byChar, sentencesForKanji }
}

export function validateContent(store: ContentStore): ContentReport {
  const warnings: string[] = []
  const kanjiWithoutSentences: number[] = []
  for (const k of store.kanji) {
    if (!store.sentencesForKanji.has(k.idx)) kanjiWithoutSentences.push(k.idx)
    if (k.gloss.length === 0) warnings.push(`${k.char} (idx ${k.idx}) has no meanings in kanji.csv`)
  }
  // Sentences reference kanji idx values — flag any that don't resolve to a known kanji.
  for (const s of store.sentences) {
    // Every kanji_list idx must be blankable (appear in some word's targets) — guarantees cloze coverage.
    const blankable = new Set<number>()
    for (const tok of s.tokens) {
      if (tok.kind === 'word') for (const t of tok.targets) blankable.add(t)
    }
    for (const idx of s.kanjiList) {
      if (!store.byIdx.has(idx)) warnings.push(`${s.id} references unknown kanji idx ${idx}`)
      else if (!blankable.has(idx)) warnings.push(`${s.id}: kanji idx ${idx} not a target of any word`)
    }
  }
  return {
    kanjiCount: store.kanji.length,
    sentenceCount: store.sentences.length,
    kanjiWithoutSentences,
    warnings,
  }
}

/** Read + parse the CSVs into a typed, indexed in-memory store. */
export async function loadContent(): Promise<ContentStore> {
  const [kanjiRows, sentenceRows, allMeanings] = await Promise.all([
    parseCsv('kanji.csv'),
    parseCsv('sentences.csv'),
    loadAllkanjiMeanings(),
  ])
  const kanji = kanjiRows.map(parseKanjiRow).sort((a, b) => a.idx - b.idx)
  // Gloss + radical + component LISTS come from kanji.csv. Per-character meaning labels start from
  // allkanji_meanings.csv (covers radicals/components/example chars) but kanji.csv wins for curriculum kanji.
  const { meanings, radicals, components } = buildDictMaps(kanjiRows)
  const meaningLookup = new Map(allMeanings)
  for (const [ch, m] of meanings) meaningLookup.set(ch, m)
  const sentences = sentenceRows.map(parseSentenceRow)
  const indexes = buildIndexes(kanji, sentences)
  const kanjiMeanings = buildKanjiMeanings(kanji, meaningLookup, radicals, components)
  const kanjiRadicals = buildKanjiRadicals(kanji, radicals)
  const kanjiComponents = buildKanjiComponents(kanji, radicals, components)
  return { kanji, sentences, ...indexes, kanjiMeanings, kanjiRadicals, kanjiComponents }
}

let cached: ContentStore | null = null

/** Load once and cache for the process lifetime. */
export async function getContent(): Promise<ContentStore> {
  if (!cached) cached = await loadContent()
  return cached
}
