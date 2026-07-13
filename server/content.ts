import { readFile } from 'node:fs/promises'
import Papa from 'papaparse'
import type { ParticleToken, Sentence, Token, Unit, Word, WordToken } from '../shared/types'

/** Project root (this file lives in server/, one level down). */
const ROOT = new URL('../', import.meta.url)

export interface ContentStore {
  units: Unit[]
  sentences: Sentence[]
  byIdx: Map<number, Unit>
  byForm: Map<string, Unit>
  /** unit idx -> sentences that contain it. */
  sentencesForUnit: Map<number, Sentence[]>
  /** char -> English meaning, for chars used by the curriculum, example words, radical, components. */
  kanjiMeanings: Record<string, string>
  /** curriculum unit form -> its classifying radical char. */
  kanjiRadicals: Record<string, string>
  /** curriculum unit form -> its component chars (excluding itself and its radical). */
  kanjiComponents: Record<string, string[]>
}

/** Matches a single CJK ideograph (kanji), excluding kana. */
const KANJI_CHAR = /[㐀-䶿一-鿿豈-﫿]/

class ContentError extends Error {}

function parseJsonField<T>(raw: string | undefined, where: string): T {
  if (raw == null || raw === '') throw new ContentError(`Missing field at ${where}`)
  try {
    return JSON.parse(raw) as T
  } catch (e) {
    throw new ContentError(`Invalid JSON at ${where}: ${(e as Error).message}`)
  }
}

function parseUnitRow(row: Record<string, string>): Unit {
  const idx = Number(row.idx)
  if (!Number.isInteger(idx)) throw new ContentError(`Bad idx "${row.idx}"`)
  const where = `unit idx=${idx}`
  const batch = Number(row.batch)
  const unit: Unit = {
    idx,
    form: row.char,
    batch: Number.isFinite(batch) && batch >= 1 ? batch : 1,
    category: row.category?.trim() || 'Everyday & Misc',
    gloss: splitMeanings(row.meanings ?? ''),
    examples: parseJsonField<Word[]>(row.examples, `${where}.examples`),
    distractors: parseJsonField<Word[]>(row.distractors, `${where}.distractors`),
  }
  if (!unit.form) throw new ContentError(`Empty form at ${where}`)
  if (unit.examples.length === 0) throw new ContentError(`No examples at ${where}`)
  return unit
}

/** The JA sentence db stores tokens with Japanese-flavoured keys (ja/en/kana/kanji); map them to
 *  the neutral Token model (surface/gloss/units) as we load — the loader is the JA→neutral adapter. */
type RawToken =
  | { kind: 'particle'; kana: string }
  | { kind: 'word'; ja: string; reading: string; en: string; kanji: string[]; targets: number[] }

function toToken(raw: RawToken): Token {
  if (raw.kind === 'particle') {
    const p: ParticleToken = { kind: 'particle', surface: raw.kana }
    return p
  }
  const w: WordToken = {
    kind: 'word',
    surface: raw.ja,
    reading: raw.reading,
    gloss: raw.en,
    units: raw.kanji,
    targets: raw.targets,
  }
  return w
}

function parseSentenceRow(row: Record<string, string>): Sentence {
  const where = `sentence id=${row.id}`
  return {
    id: row.id,
    unitList: parseJsonField<number[]>(row.kanji_list, `${where}.kanji_list`),
    tokens: parseJsonField<RawToken[]>(row.tokens, `${where}.tokens`).map(toToken),
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
 * char→meaning lookup from ja_meanings.csv — used only to label radical / component / example
 * characters that aren't curriculum units (curriculum meanings come from ja_kanji.csv and override these).
 */
async function loadAllkanjiMeanings(): Promise<Map<string, string>> {
  const text = await readFile(new URL('dbs/ja_meanings.csv', ROOT), 'utf8')
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  const map = new Map<string, string>()
  for (const r of data) {
    const char = r.kanji?.trim()
    const meaning = (r.meanings ?? '').trim()
    if (char && meaning) map.set(char, meaning)
  }
  return map
}

/** char→meaning / char→radical / char→components maps, read from the ja_kanji.csv rows. */
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

/** A char->meaning map covering every char used by the curriculum, examples, radical, components. */
function buildKanjiMeanings(
  units: Unit[],
  meanings: Map<string, string>,
  radicals: Map<string, string>,
  components: Map<string, string[]>,
): Record<string, string> {
  const needed = new Set<string>()
  for (const k of units) {
    needed.add(k.form)
    for (const ex of k.examples) {
      for (const ch of ex.word) if (KANJI_CHAR.test(ch)) needed.add(ch)
    }
    const rad = radicals.get(k.form)
    if (rad) needed.add(rad)
    for (const c of components.get(k.form) ?? []) needed.add(c)
  }
  const out: Record<string, string> = {}
  for (const ch of needed) {
    const m = meanings.get(ch)
    if (m) out[ch] = m
  }
  return out
}

/** curriculum unit form -> its radical char. */
function buildKanjiRadicals(units: Unit[], radicals: Map<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of units) {
    const rad = radicals.get(k.form)
    if (rad) out[k.form] = rad
  }
  return out
}

/** curriculum unit form -> its component chars (excluding the unit itself and its radical). */
function buildKanjiComponents(
  units: Unit[],
  radicals: Map<string, string>,
  components: Map<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const k of units) {
    const rad = radicals.get(k.form)
    const comps = (components.get(k.form) ?? []).filter((c) => c !== k.form && c !== rad)
    if (comps.length) out[k.form] = comps
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

function buildIndexes(units: Unit[], sentences: Sentence[]): {
  byIdx: Map<number, Unit>
  byForm: Map<string, Unit>
  sentencesForUnit: Map<number, Sentence[]>
} {
  const byIdx = new Map<number, Unit>()
  const byForm = new Map<string, Unit>()
  for (const k of units) {
    byIdx.set(k.idx, k)
    byForm.set(k.form, k)
  }
  const sentencesForUnit = new Map<number, Sentence[]>()
  for (const s of sentences) {
    for (const idx of s.unitList) {
      const list = sentencesForUnit.get(idx)
      if (list) list.push(s)
      else sentencesForUnit.set(idx, [s])
    }
  }
  return { byIdx, byForm, sentencesForUnit }
}

export function validateContent(store: ContentStore): ContentReport {
  const warnings: string[] = []
  const kanjiWithoutSentences: number[] = []
  for (const k of store.units) {
    if (!store.sentencesForUnit.has(k.idx)) kanjiWithoutSentences.push(k.idx)
    if (k.gloss.length === 0) warnings.push(`${k.form} (idx ${k.idx}) has no meanings in ja_kanji.csv`)
  }
  // Sentences reference unit idx values — flag any that don't resolve to a known unit.
  for (const s of store.sentences) {
    // Every unitList idx must be blankable (appear in some word's targets) — guarantees cloze coverage.
    const blankable = new Set<number>()
    for (const tok of s.tokens) {
      if (tok.kind === 'word') for (const t of tok.targets) blankable.add(t)
    }
    for (const idx of s.unitList) {
      if (!store.byIdx.has(idx)) warnings.push(`${s.id} references unknown unit idx ${idx}`)
      else if (!blankable.has(idx)) warnings.push(`${s.id}: unit idx ${idx} not a target of any word`)
    }
  }
  return {
    kanjiCount: store.units.length,
    sentenceCount: store.sentences.length,
    kanjiWithoutSentences,
    warnings,
  }
}

/** Read + parse the CSVs into a typed, indexed in-memory store. */
export async function loadContent(): Promise<ContentStore> {
  const [unitRows, sentenceRows, allMeanings] = await Promise.all([
    parseCsv('ja_kanji.csv'),
    parseCsv('ja_sentences.csv'),
    loadAllkanjiMeanings(),
  ])
  const units = unitRows.map(parseUnitRow).sort((a, b) => a.idx - b.idx)
  // Gloss + radical + component LISTS come from ja_kanji.csv. Per-character meaning labels start from
  // ja_meanings.csv (covers radicals/components/example chars) but ja_kanji.csv wins for curriculum units.
  const { meanings, radicals, components } = buildDictMaps(unitRows)
  const meaningLookup = new Map(allMeanings)
  for (const [ch, m] of meanings) meaningLookup.set(ch, m)
  const sentences = sentenceRows.map(parseSentenceRow)
  const indexes = buildIndexes(units, sentences)
  const kanjiMeanings = buildKanjiMeanings(units, meaningLookup, radicals, components)
  const kanjiRadicals = buildKanjiRadicals(units, radicals)
  const kanjiComponents = buildKanjiComponents(units, radicals, components)
  return { units, sentences, ...indexes, kanjiMeanings, kanjiRadicals, kanjiComponents }
}

let cached: ContentStore | null = null

/** Load once and cache for the process lifetime. */
export async function getContent(): Promise<ContentStore> {
  if (!cached) cached = await loadContent()
  return cached
}
