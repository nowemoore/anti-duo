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
   * Every distinct example word — the curated vocabulary, and the only thing a "known word" run is
   * kept for.
   *
   * Sentence tokens are deliberately excluded: they include inflections (食べた, 待って), names
   * (田中) and kana scaffolding (ある, いる), so crediting them would count 食べた as a second word
   * alongside 食べる and inflate the total with things nobody would call vocabulary.
   */
  words: Set<string>
  /**
   * Reading for each word in {@link words}. A word that appears under two units (一人 under both 一
   * and 人) keeps the first reading found — they agree, since it's the same vocabulary entry.
   */
  wordReadings: Map<string, string>
  /** Engine-tier language logic (okurigana distractors, native-script test) for this content. */
  lang: LangEngine
}

export function buildContentIndex(content: Content): ContentIndex {
  const byIdx = new Map<number, Unit>()
  const byForm = new Map<string, Unit>()
  const words = new Set<string>()
  const wordReadings = new Map<string, string>()
  for (const k of content.units) {
    byIdx.set(k.idx, k)
    byForm.set(k.form, k)
    for (const ex of k.examples) {
      words.add(ex.word)
      if (!wordReadings.has(ex.word)) wordReadings.set(ex.word, ex.reading)
    }
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
    wordReadings,
    lang: getLangEngine(content.lang),
  }
}
