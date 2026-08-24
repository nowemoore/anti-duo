import type { Content, Unit, Sentence } from '../../shared/types'
import { getLangEngine, type LangEngine } from './lang'

/** A topical category with the units it contains (idx-ordered). */
export interface Category {
  name: string
  units: Unit[]
}

/** Client-side indexes over the content payload, mirroring the server's. */
export interface ContentIndex {
  content: Content
  byIdx: Map<number, Unit>
  byForm: Map<string, Unit>
  /** unit idx -> sentences containing it. */
  sentencesForUnit: Map<number, Sentence[]>
  /** Categories ordered by their first (lowest) unit idx. */
  categories: Category[]
  /**
   * Every distinct example word, as {@link wordKey} values — the curated vocabulary, and the only
   * thing a "known word" run is kept for.
   *
   * Sentence tokens are deliberately excluded: they include inflections (食べた, 待って), names
   * (田中) and kana scaffolding (ある, いる), so crediting them would count 食べた as a second word
   * alongside 食べる and inflate the total with things nobody would call vocabulary.
   */
  words: Set<string>
  /**
   * A reading for each word in {@link words}, for display where only one can be shown.
   *
   * Where a written form has more than one reading (木 is き and もく) this holds whichever the
   * registry lists first. Anything that must not silently pick one — grading, or building options —
   * uses {@link readingsOf} instead.
   */
  wordReadings: Map<string, string>
  /** Surface + reading behind each {@link words} key, for anything that has to display them. */
  wordEntries: Map<string, { surface: string; reading: string }>
  /**
   * Every reading of each written form. Five forms have two (十分, 木, 中, 国, 家), which makes them
   * the reason this exists: a "pick the reading" question drawing its distractors from the general
   * pool would otherwise offer もく as a wrong answer to 木, and it isn't wrong.
   */
  readingsOf: Map<string, string[]>
  /** Engine-tier language logic (okurigana distractors, native-script test) for this content. */
  lang: LangEngine
}

/**
 * The key a word's "known" run is stored under in `Progress.words`.
 *
 * A written form alone is not enough. 木 is two words — き "tree" and もく "wood" — and keying by
 * surface gave them one shared run, so missing き walked もく backwards and getting もく right
 * credited き. The same held for 十分, 中, 国 and 家.
 *
 * The reading is only appended where it has to be, so the 900-odd unambiguous words keep the exact
 * key they already had and no existing progress is disturbed by this distinction being drawn.
 */
export function wordKey(
  readingsOf: ReadonlyMap<string, string[]>,
  surface: string,
  reading: string,
): string {
  return (readingsOf.get(surface)?.length ?? 0) > 1 ? `${surface}|${reading}` : surface
}

export function buildContentIndex(content: Content): ContentIndex {
  const byIdx = new Map<number, Unit>()
  const byForm = new Map<string, Unit>()
  const wordReadings = new Map<string, string>()
  const readingsOf = new Map<string, string[]>()
  /** Collected first, keyed second: the key depends on how many readings the surface turns out to have. */
  const examples: { surface: string; reading: string }[] = []
  for (const k of content.units) {
    byIdx.set(k.idx, k)
    byForm.set(k.form, k)
    for (const ex of k.examples) {
      examples.push({ surface: ex.word, reading: ex.reading })
      if (!wordReadings.has(ex.word)) wordReadings.set(ex.word, ex.reading)
      const readings = readingsOf.get(ex.word)
      if (readings) {
        if (!readings.includes(ex.reading)) readings.push(ex.reading)
      } else readingsOf.set(ex.word, [ex.reading])
    }
  }
  const words = new Set<string>()
  const wordEntries = new Map<string, { surface: string; reading: string }>()
  for (const ex of examples) {
    const key = wordKey(readingsOf, ex.surface, ex.reading)
    words.add(key)
    if (!wordEntries.has(key)) wordEntries.set(key, ex)
  }

  const sentencesForUnit = new Map<number, Sentence[]>()
  for (const s of content.sentences) {
    for (const idx of s.unitList) {
      const list = sentencesForUnit.get(idx)
      if (list) list.push(s)
      else sentencesForUnit.set(idx, [s])
    }
  }

  // Group units by category (content is idx-sorted, so each group stays idx-ordered),
  // then order categories by their lowest idx.
  const grouped = new Map<string, Unit[]>()
  for (const k of content.units) {
    const list = grouped.get(k.category)
    if (list) list.push(k)
    else grouped.set(k.category, [k])
  }
  const categories: Category[] = [...grouped.entries()]
    .map(([name, units]) => ({ name, units }))
    .sort((a, b) => a.units[0].idx - b.units[0].idx)

  return {
    content,
    byIdx,
    byForm,
    sentencesForUnit,
    categories,
    words,
    wordEntries,
    wordReadings,
    readingsOf,
    lang: getLangEngine(content.lang),
  }
}
